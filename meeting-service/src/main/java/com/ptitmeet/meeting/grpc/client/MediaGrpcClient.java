package com.ptitmeet.meeting.grpc.client;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.grpc.media.CompensateRequest;
import com.ptitmeet.grpc.media.MediaGrpcServiceGrpc;
import com.ptitmeet.grpc.media.RecordingResponse;
import com.ptitmeet.grpc.media.StartRecordingRequest;
import com.ptitmeet.grpc.media.StopRecordingRequest;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Service;

@Service
public class MediaGrpcClient {

    @GrpcClient("media-grpc-client")
    private MediaGrpcServiceGrpc.MediaGrpcServiceBlockingStub mediaStub;

    public RecordingResponse startRecording(String meetingCode, String ownerId) {
        try {
            return mediaStub.startRecording(
                    StartRecordingRequest.newBuilder()
                            .setMeetingCode(meetingCode)
                            .setOwnerId(ownerId)
                            .build());
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public void stopRecording(String egressId) {
        try {
            mediaStub.stopRecording(
                    StopRecordingRequest.newBuilder().setEgressId(egressId).build());
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public void compensateRecording(String egressId) {
        try {
            mediaStub.compensateRecording(
                    CompensateRequest.newBuilder().setEgressId(egressId).build());
        } catch (StatusRuntimeException e) {
            // Log warning
        }
    }
}
