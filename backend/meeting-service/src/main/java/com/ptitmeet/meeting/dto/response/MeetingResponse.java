package com.ptitmeet.meeting.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingResponse {
    @JsonProperty("meeting_id")
    private String meetingId;

    @JsonProperty("meeting_code")
    private String meetingCode;

    private String title;

    @JsonProperty("is_instant")
    private Boolean isInstant;

    @JsonProperty("start_time")
    private LocalDateTime startTime;

    @JsonProperty("end_time")
    private LocalDateTime endTime;

    @JsonProperty("access_type")
    private String accessType;

    private String status;

    @JsonProperty("join_token")
    private String joinToken; // Trả về nếu là instant meeting
    
    @JsonProperty("created_at")
    private LocalDateTime createdAt;
}
