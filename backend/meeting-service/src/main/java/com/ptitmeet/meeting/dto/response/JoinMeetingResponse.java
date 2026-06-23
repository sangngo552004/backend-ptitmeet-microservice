package com.ptitmeet.meeting.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class JoinMeetingResponse {
    private String status;          // "APPROVED" hoặc "PENDING"
    private String message;
    private String token;           // LiveKit token (null nếu PENDING)
    private String serverUrl;       // LiveKit WSS URL (null nếu PENDING)
    private String role;            // "HOST" hoặc "GUEST"
    private Boolean isOwner;
    private String currentHostId;
    private String settings;        // Meeting settings JSON
}
