package com.ptitmeet.meeting.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class SystemEvent {
    private String action;
    private String targetUserId;
    private String egressId;
    private String newHostId;
    private String newHostName;
}
