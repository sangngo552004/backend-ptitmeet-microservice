package com.ptitmeet.meeting.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingHistoryResponse {
    @JsonProperty("meeting_code")
    private String meetingCode;

    private String title;

    @JsonProperty("start_time")
    private LocalDateTime startTime;

    @JsonProperty("end_time")
    private LocalDateTime endTime;

    private String status;

    @JsonProperty("is_host")
    private boolean isHost;

    @JsonProperty("is_owner")
    private boolean isOwner;

    @JsonProperty("can_view_recordings")
    private boolean canViewRecordings;

    @JsonProperty("can_view_chat_history")
    private boolean canViewChatHistory;
}
