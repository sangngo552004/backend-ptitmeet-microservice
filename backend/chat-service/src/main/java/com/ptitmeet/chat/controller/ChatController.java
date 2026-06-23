package com.ptitmeet.chat.controller;

import com.ptitmeet.chat.dto.SendMessageRequest;
import com.ptitmeet.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Handles STOMP messages from clients.
 *
 * Flow:
 *   Client SEND → /app/chat/{meetingCode}
 *   Service saves + broadcasts → /topic/chat/{meetingCode}
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @MessageMapping("/chat/{meetingCode}")
    public void handleChatMessage(
            @DestinationVariable String meetingCode,
            @Payload SendMessageRequest req,
            SimpMessageHeaderAccessor headerAccessor) {

        Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
        if (sessionAttrs == null) return;

        String senderId = (String) sessionAttrs.get("userId");
        String senderName = (String) sessionAttrs.getOrDefault("userName", "Unknown");

        // Từ chối nếu không có userId (kết nối không qua Gateway)
        if (senderId == null) {
            log.warn("Received STOMP message without userId for meeting {}", meetingCode);
            return;
        }

        chatService.sendMessage(meetingCode, senderId, senderName, req);
        // Broadcast đã xử lý bên trong sendMessage()
    }
}
