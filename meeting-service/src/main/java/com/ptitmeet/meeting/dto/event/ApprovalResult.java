package com.ptitmeet.meeting.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class ApprovalResult {
    private String action;       // "APPROVED" hoặc "REJECTED"
    private String token;
    private String serverUrl;
    private String role;
    private String message;
    private String currentHostId;
    private String settings;
}
