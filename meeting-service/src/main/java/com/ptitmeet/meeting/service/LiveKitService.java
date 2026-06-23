package com.ptitmeet.meeting.service;

import io.livekit.server.AccessToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class LiveKitService {

    @Value("${livekit.host}")
    private String livekitHost;

    @Value("${livekit.api-key}")
    private String apiKey;

    @Value("${livekit.api-secret}")
    private String apiSecret;

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
        return livekitHost.replace("https://", "wss://")
                          .replace("http://", "ws://");
    }
}
