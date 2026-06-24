package com.ptitmeet.media.service;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.media.entity.MeetingRecording;
import com.ptitmeet.media.repository.MeetingRecordingRepository;
import io.livekit.server.WebhookReceiver;
import livekit.LivekitEgress.EgressInfo;
import livekit.LivekitEgress.EgressStatus;
import livekit.LivekitWebhook.WebhookEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class LiveKitWebhookService {

    @Value("${livekit.api-key}")
    private String apiKey;

    @Value("${livekit.api-secret}")
    private String apiSecret;

    @Value("${aws.s3.livekit-record-domain}")
    private String livekitRecordDomain;

    private final MeetingRecordingRepository recordingRepository;

    public String processWebhook(String body, String authHeader) {
        try {
            WebhookReceiver receiver = new WebhookReceiver(apiKey, apiSecret);
            WebhookEvent event = receiver.receive(body, authHeader);

            log.info("LiveKit webhook: event={}", event.getEvent());

            if ("egress_ended".equals(event.getEvent())) {
                handleEgressEnded(event.getEgressInfo());
            }

            return "OK";

        } catch (Exception e) {
            log.error("Webhook processing failed: {}", e.getMessage());
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    private void handleEgressEnded(EgressInfo egressInfo) {
        if (egressInfo == null) return;

        String egressId = egressInfo.getEgressId();
        MeetingRecording recording = recordingRepository
                .findByEgressId(egressId)
                .orElse(null);

        if (recording == null) {
            log.warn("Received webhook for unknown egressId: {}", egressId);
            return;
        }

        // Update status based on egress status
        if (egressInfo.getStatus() == EgressStatus.EGRESS_COMPLETE) {
            // Lấy file URL từ S3 output
            String fileUrl = extractFileUrl(egressInfo);
            recording.setStatus(MeetingRecording.RecordingStatus.COMPLETED);
            recording.setFileUrl(fileUrl);
            recording.setCompletedAt(LocalDateTime.now());
        } else if (egressInfo.getStatus() == EgressStatus.EGRESS_FAILED) {
            recording.setStatus(MeetingRecording.RecordingStatus.FAILED);
            recording.setCompletedAt(LocalDateTime.now());
            log.error("Egress {} failed: {}", egressId, egressInfo.getError());
        }

        recordingRepository.save(recording);
    }

    private String extractFileUrl(EgressInfo egressInfo) {
        // Lấy URL từ S3 output file
        try {
            if (!egressInfo.getFileResultsList().isEmpty()) {
                var fileResult = egressInfo.getFileResults(0);
                String location = fileResult.getLocation(); // s3:// hoặc https:// URL
                
                if (livekitRecordDomain != null && !livekitRecordDomain.trim().isEmpty()) {
                    String domain = livekitRecordDomain.trim();
                    if (!domain.endsWith("/")) {
                        domain += "/";
                    }
                    return domain + fileResult.getFilename();
                }
                
                return location;
            }
        } catch (Exception e) {
            log.error("Error extracting file URL: {}", e.getMessage());
        }
        return null;
    }
}
