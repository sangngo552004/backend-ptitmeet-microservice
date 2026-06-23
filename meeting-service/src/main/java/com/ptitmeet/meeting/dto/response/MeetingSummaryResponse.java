package com.ptitmeet.meeting.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingSummaryResponse {
    private String duration;       // VD: "1h 30m" hoặc "45m"
    private Integer participants;  // Số người tham gia (distinct)
    private Integer messages;      // TODO: gọi Chat Service gRPC (Phase 10), hiện tại để 0
}
