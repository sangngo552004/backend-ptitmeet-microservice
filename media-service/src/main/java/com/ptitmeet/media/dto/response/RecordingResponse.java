package com.ptitmeet.media.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RecordingResponse {
    private String egressId;
    private String roomName;
    private String status;
    private String fileUrl;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
