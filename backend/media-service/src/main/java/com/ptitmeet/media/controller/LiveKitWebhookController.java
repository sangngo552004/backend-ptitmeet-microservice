package com.ptitmeet.media.controller;

import com.ptitmeet.media.service.LiveKitWebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class LiveKitWebhookController {

    private final LiveKitWebhookService webhookService;

    // KHÔNG có JWT (LiveKit dùng webhook secret riêng)
    @PostMapping("/api/livekit/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String body,
            @RequestHeader("Authorization") String authHeader) {
        String result = webhookService.processWebhook(body, authHeader);
        return ResponseEntity.ok(result);
    }
}
