package com.ptitmeet.meeting.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class WaitingRoomNotification {
    private String action;          // "JOIN_REQUEST"
    private String participantId;
    private String userId;
    private String displayName;
    private LocalDateTime requestTime;
}
