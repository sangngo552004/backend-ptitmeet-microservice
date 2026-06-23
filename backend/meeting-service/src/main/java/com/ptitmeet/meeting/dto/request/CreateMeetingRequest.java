package com.ptitmeet.meeting.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateMeetingRequest {
    private String title;

    @JsonProperty("start_time")
    private LocalDateTime startTime;

    @JsonProperty("end_time")
    private LocalDateTime endTime;

    @JsonProperty("access_type")
    @Builder.Default
    private String accessType = "OPEN";  // OPEN, TRUSTED, RESTRICTED

    private String password;
    private String allowedDomain;

    @JsonProperty("participant_emails")
    @Builder.Default
    private List<String> participantEmails = new ArrayList<>();

    private String settings;  // JSON string, nullable
}
