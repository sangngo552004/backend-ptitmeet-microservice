package com.ptitmeet.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMessageResponse {
    private String id;
    private String meetingCode;
    private String senderId;
    private String senderName;
    private String content;
    private LocalDateTime timestamp;
}
