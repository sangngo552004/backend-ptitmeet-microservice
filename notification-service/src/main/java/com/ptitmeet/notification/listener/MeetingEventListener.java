package com.ptitmeet.notification.listener;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ptitmeet.notification.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingEventListener {

    private final ObjectMapper objectMapper;
    private final EmailService emailService;

    @KafkaListener(topics = "meeting-events", groupId = "notification-group")
    public void handleMeetingEvent(String message) {
        try {
            JsonNode eventNode = objectMapper.readTree(message);
            String eventType = eventNode.get("eventType").asText();

            if ("MEETING_SCHEDULED".equals(eventType)) {
                JsonNode payloadNode = objectMapper.readTree(eventNode.get("payload").asText());
                
                String title = payloadNode.has("title") ? payloadNode.get("title").asText() : null;
                String meetingCode = payloadNode.has("meetingCode") ? payloadNode.get("meetingCode").asText() : null;
                String startTime = payloadNode.has("startTime") && !payloadNode.get("startTime").isNull() 
                        ? payloadNode.get("startTime").asText() : null;
                
                if (payloadNode.has("invitedEmails") && payloadNode.get("invitedEmails").isArray()) {
                    for (JsonNode emailNode : payloadNode.get("invitedEmails")) {
                        String email = emailNode.asText();
                        emailService.sendMeetingInvitation(email, meetingCode, title, startTime);
                    }
                }
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Kafka message: {}", e.getMessage());
        } catch (Exception e) {
            log.error("Error processing message from Kafka: {}", e.getMessage(), e);
        }
    }
}
