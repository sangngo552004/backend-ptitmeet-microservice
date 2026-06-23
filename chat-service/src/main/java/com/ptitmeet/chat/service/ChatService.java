package com.ptitmeet.chat.service;

import com.ptitmeet.chat.document.ChatMessage;
import com.ptitmeet.chat.dto.ChatMessageResponse;
import com.ptitmeet.chat.dto.SendMessageRequest;
import com.ptitmeet.chat.repository.ChatMessageRepository;
import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Lưu tin nhắn vào MongoDB và broadcast tới tất cả subscriber của phòng.
     */
    public ChatMessageResponse sendMessage(
            String meetingCode, String senderId, String senderName, SendMessageRequest req) {

        // 1. Validate content
        if (req.getContent() == null || req.getContent().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        // 2. Resolve senderName: ưu tiên từ request, fallback từ session
        String name = (req.getSenderName() != null && !req.getSenderName().isBlank())
                ? req.getSenderName() : senderName;

        // 3. Save to MongoDB
        ChatMessage message = chatMessageRepository.save(ChatMessage.builder()
                .meetingCode(meetingCode)
                .senderId(senderId)
                .senderName(name)
                .content(req.getContent())
                .timestamp(LocalDateTime.now())
                .build());

        log.debug("Chat message saved: id={}, meeting={}, sender={}", message.getId(), meetingCode, senderId);

        // 4. Build response
        ChatMessageResponse response = toResponse(message);

        // 5. Broadcast tới tất cả subscriber trong phòng
        messagingTemplate.convertAndSend("/topic/chat/" + meetingCode, response);

        return response;
    }

    /**
     * Lấy toàn bộ lịch sử chat của một phòng, sắp xếp theo thời gian tăng dần.
     */
    public List<ChatMessageResponse> getChatHistory(String meetingCode) {
        return chatMessageRepository
                .findByMeetingCodeOrderByTimestampAsc(meetingCode)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Đếm số tin nhắn trong một phòng (dùng cho Meeting Summary).
     */
    public long getMessageCount(String meetingCode) {
        return chatMessageRepository.countByMeetingCode(meetingCode);
    }

    private ChatMessageResponse toResponse(ChatMessage message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .meetingCode(message.getMeetingCode())
                .senderId(message.getSenderId())
                .senderName(message.getSenderName())
                .content(message.getContent())
                .timestamp(message.getTimestamp())
                .build();
    }
}
