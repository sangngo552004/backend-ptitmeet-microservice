package com.ptitmeet.meeting.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ParticipantResponse {
    @JsonProperty("participant_id")
    private String participantId;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("display_name")
    private String displayName;

    private String email;       // TODO: lấy từ Identity Service (Phase 10), hiện tại để null

    @JsonProperty("avatar_url")
    private String avatarUrl;   // TODO: Phase 10

    private String status;      // ApprovalStatus

    @JsonProperty("request_time")
    private LocalDateTime requestTime;
}
