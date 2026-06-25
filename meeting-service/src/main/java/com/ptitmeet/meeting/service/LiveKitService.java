package com.ptitmeet.meeting.service;

import io.livekit.server.AccessToken;
import io.livekit.server.RoomServiceClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
public class LiveKitService {

    @Value("${livekit.host}")
    private String livekitHost;

    @Value("${livekit.api-key}")
    private String apiKey;

    @Value("${livekit.api-secret}")
    private String apiSecret;

    @Value("${livekit.ws-url}")
    private String wsUrl;

    public String generateJoinToken(String roomName, String participantIdentity,
                                     String participantName, boolean isHost) {

        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setName(participantName);
        token.setIdentity(participantIdentity);
        token.setTtl(Duration.ofHours(4).getSeconds());  // Token sống 4 giờ
        
        token.addGrants(
                new io.livekit.server.RoomJoin(true),
                new io.livekit.server.RoomName(roomName),
                new io.livekit.server.CanPublish(true),
                new io.livekit.server.CanSubscribe(true)
        );
        
        if (isHost) {
            token.addGrants(new io.livekit.server.RoomAdmin(true));
        }

        return token.toJwt();
    }

    public String getLivekitServerUrl() {
        if (wsUrl != null && !wsUrl.trim().isEmpty()) {
            return wsUrl.trim();
        }
        return livekitHost.replace("https://", "wss://")
                          .replace("http://", "ws://");
    }

    public void endRoom(String roomName) {
        if (roomName == null || roomName.trim().isEmpty()) {
            return;
        }
        try {
            RoomServiceClient roomClient = RoomServiceClient.create(livekitHost, apiKey, apiSecret);
            roomClient.deleteRoom(roomName).execute();
        } catch (Exception exception) {
            log.warn("Could not delete LiveKit room {}: {}", roomName, exception.getMessage());
        }
    }
}
