package com.ptitmeet.media.service;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.media.dto.response.RecordingResponse;
import com.ptitmeet.media.entity.MeetingRecording;
import com.ptitmeet.media.grpc.client.MeetingGrpcClient;
import com.ptitmeet.grpc.meeting.MeetingOwnerResponse;
import com.ptitmeet.media.repository.MeetingRecordingRepository;
import io.livekit.server.EgressServiceClient;
import livekit.LivekitEgress.EgressInfo;
import livekit.LivekitEgress.EncodedFileOutput;
import livekit.LivekitEgress.EncodedFileType;

import livekit.LivekitEgress.S3Upload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecordingService {

    private final MeetingRecordingRepository meetingRecordingRepository;
    private final MeetingGrpcClient meetingGrpcClient;

    @Value("${livekit.host}")
    private String livekitHost;

    @Value("${livekit.api-key}")
    private String livekitApiKey;

    @Value("${livekit.api-secret}")
    private String livekitApiSecret;

    @Value("${aws.s3.bucket}")
    private String s3Bucket;

    @Value("${aws.s3.region}")
    private String s3Region;

    @Value("${aws.s3.access-key}")
    private String s3AccessKey;

    @Value("${aws.s3.secret-key}")
    private String s3SecretKey;

    @Transactional
    public RecordingResponse startRecording(String callerUserId, String meetingCode) {
        // 0. Verify owner via Meeting Service
        MeetingOwnerResponse ownerInfo = meetingGrpcClient.getMeetingOwner(meetingCode);
        if (!callerUserId.equals(ownerInfo.getOwnerId())) {
            throw new AppException(ErrorCode.ONLY_OWNER);
        }

        // 1. Kiểm tra đã có recording RUNNING không
        meetingRecordingRepository
                .findByRoomNameAndStatus(meetingCode, MeetingRecording.RecordingStatus.RECORDING)
                .ifPresent(r -> { throw new AppException(ErrorCode.RECORDING_ALREADY_RUNNING); });

        // 2. Tạo S3 config cho LiveKit Egress
        String objectKey = meetingCode + "/" + System.currentTimeMillis() + ".mp4";

        EgressInfo egressInfo;
        try {
            EgressServiceClient egressClient = EgressServiceClient.create(
                    livekitHost, livekitApiKey, livekitApiSecret);

            egressInfo = egressClient.startRoomCompositeEgress(
                    meetingCode,
                    EncodedFileOutput.newBuilder()
                            .setFileType(EncodedFileType.MP4)
                            .setFilepath(objectKey)
                            .setS3(S3Upload.newBuilder()
                                    .setAccessKey(s3AccessKey)
                                    .setSecret(s3SecretKey)
                                    .setBucket(s3Bucket)
                                    .setRegion(s3Region)
                                    .build())
                            .build()
            ).execute().body();
        } catch (Exception e) {
            log.error("LiveKit Egress error: {}", e.getMessage());
            throw new AppException(ErrorCode.LIVEKIT_ERROR);
        }

        // 3. Lưu metadata vào DB
        MeetingRecording recording = MeetingRecording.builder()
                .roomName(meetingCode)
                .egressId(egressInfo.getEgressId())
                .meetingId(ownerInfo.getMeetingId())  // Lấy meetingId từ ownerInfo qua gRPC
                .ownerId(callerUserId)
                .status(MeetingRecording.RecordingStatus.RECORDING)
                .build();

        recording = meetingRecordingRepository.save(recording);
        return toResponse(recording);
    }

    public void stopRecording(String egressId) {
        meetingRecordingRepository
                .findByEgressId(egressId)
                .orElseThrow(() -> new AppException(ErrorCode.RECORDING_NOT_FOUND));

        try {
            EgressServiceClient egressClient = EgressServiceClient.create(
                    livekitHost, livekitApiKey, livekitApiSecret);
            egressClient.stopEgress(egressId).execute();
        } catch (Exception e) {
            log.error("Error stopping egress {}: {}", egressId, e.getMessage());
            throw new AppException(ErrorCode.LIVEKIT_ERROR);
        }
        // Status sẽ được cập nhật khi nhận webhook từ LiveKit
    }

    public List<RecordingResponse> getMyRecordings(String ownerId) {
        return meetingRecordingRepository
                .findByOwnerIdOrderByCreatedAtDesc(ownerId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public void compensateRecording(String egressId) {
        MeetingRecording recording = meetingRecordingRepository
                .findByEgressId(egressId)
                .orElse(null);

        if (recording == null) return;  // Idempotent: không tìm thấy thì bỏ qua

        // Nếu còn RECORDING, stop egress trước
        if (recording.getStatus() == MeetingRecording.RecordingStatus.RECORDING) {
            try {
                EgressServiceClient egressClient = EgressServiceClient.create(
                        livekitHost, livekitApiKey, livekitApiSecret);
                egressClient.stopEgress(egressId).execute();
            } catch (Exception ignored) {
                // Best effort, không throw exception
            }
        }

        meetingRecordingRepository.delete(recording);
    }

    private RecordingResponse toResponse(MeetingRecording recording) {
        return RecordingResponse.builder()
                .egressId(recording.getEgressId())
                .roomName(recording.getRoomName())
                .status(recording.getStatus().name())
                .fileUrl(recording.getFileUrl())
                .createdAt(recording.getCreatedAt())
                .completedAt(recording.getCompletedAt())
                .build();
    }
}
