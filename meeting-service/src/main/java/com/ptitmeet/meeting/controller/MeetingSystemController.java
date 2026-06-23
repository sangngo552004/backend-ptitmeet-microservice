package com.ptitmeet.meeting.controller;

import com.ptitmeet.meeting.dto.request.SystemMessage;
import com.ptitmeet.meeting.service.MeetingService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class MeetingSystemController {

    private final MeetingService meetingService;

    /**
     * Host gửi lệnh điều khiển qua STOMP.
     * Client gửi tới: /app/meeting/{code}/system
     * Payload: SystemMessage { action, targetUserId, egressId }
     *
     * Supported actions:
     *   MUTE_ALL, STOP_CAMERA_ALL,
     *   MUTE_PARTICIPANT, STOP_CAMERA_PARTICIPANT,
     *   KICK_PARTICIPANT,
     *   RECORDING_STARTED, RECORDING_STOPPED
     */
    @MessageMapping("/meeting/{code}/system")
    public void handleSystemAction(
            @DestinationVariable String code,
            @Payload SystemMessage message,
            SimpMessageHeaderAccessor headerAccessor) {

        // userId được set vào session attributes bởi HandshakeInterceptor trong WebSocketConfig
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");
        meetingService.handleSystemAction(userId, code, message);
    }
}
