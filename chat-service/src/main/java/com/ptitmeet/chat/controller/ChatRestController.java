package com.ptitmeet.chat.controller;

import com.ptitmeet.chat.dto.ChatMessageResponse;
import com.ptitmeet.chat.service.ChatService;
import com.ptitmeet.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for chat history and message count.
 * Used by Meeting Service (Phase 10 gRPC) and frontend.
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatRestController {

    private final ChatService chatService;

    /**
     * Lấy lịch sử chat của một phòng họp.
     * Dùng bởi Meeting Service (Phase 10) và client xem lại chat.
     */
    @GetMapping("/{meetingCode}/history")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getChatHistory(
            @PathVariable String meetingCode) {
        return ResponseEntity.ok(ApiResponse.success(
                chatService.getChatHistory(meetingCode)));
    }

    /**
     * Đếm số tin nhắn trong phòng — dùng cho Meeting Summary.
     */
    @GetMapping("/{meetingCode}/count")
    public ResponseEntity<ApiResponse<Long>> getMessageCount(
            @PathVariable String meetingCode) {
        return ResponseEntity.ok(ApiResponse.success(
                chatService.getMessageCount(meetingCode)));
    }
}
