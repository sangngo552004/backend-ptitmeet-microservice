package com.ptitmeet.meeting.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingInfoResponse {
    @JsonProperty("meeting_code")
    private String meetingCode;

    private String title;

    @JsonProperty("host_name")
    private String hostName;

    private String status;

    @JsonProperty("access_type")
    private String accessType;

    @JsonProperty("is_password_protected")
    private Boolean isPasswordProtected;
}
