package com.ptitmeet.meeting.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class JoinMeetingRequest {
    private String displayName;   // Optional, dùng khi user chưa set tên
    private String password;      // Optional, cần nếu meeting có password
}
