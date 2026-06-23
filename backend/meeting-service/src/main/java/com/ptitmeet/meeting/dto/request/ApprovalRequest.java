package com.ptitmeet.meeting.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class ApprovalRequest {
    @NotBlank
    private String participantId;
    @NotBlank
    private String action;  // "APPROVED" hoặc "REJECTED"
}
