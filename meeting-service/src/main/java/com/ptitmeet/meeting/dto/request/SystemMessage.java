package com.ptitmeet.meeting.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class SystemMessage {
    private String action;          // "MUTE_ALL", "KICK_PARTICIPANT", etc.
    private String targetUserId;
    private String egressId;
}
