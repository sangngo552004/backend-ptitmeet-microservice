package com.ptitmeet.gateway.config;

import com.ptitmeet.gateway.filter.JwtAuthFilterFactory;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder, JwtAuthFilterFactory jwtAuthFilterFactory) {
        return builder.routes()

                // === IDENTITY SERVICE ===
                // Auth endpoints — skipAuth = true
                .route("identity-auth", r -> r
                        .path("/api/auth/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(true))))
                        .uri("lb://identity-service"))

                // User endpoints — yêu cầu JWT
                .route("identity-users", r -> r
                        .path("/api/users/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(false))))
                        .uri("lb://identity-service"))

                // Internal endpoints
                .route("identity-internal", r -> r
                        .path("/internal/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(true))))
                        .uri("lb://identity-service"))

                // === MEETING SERVICE ===
                .route("meeting-service", r -> r
                        .path("/api/meetings/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(false))))
                        .uri("lb://meeting-service"))

                // Meeting Service WebSocket/STOMP
                .route("meeting-service-ws", r -> r
                        .path("/ws-meeting/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(true))))  // Token handled by client query param
                        .uri("lb:ws://meeting-service"))

                // === MEDIA SERVICE ===
                // Webhook — skipAuth (LiveKit callback)
                .route("media-webhook", r -> r
                        .path("/api/livekit/webhook")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(true))))
                        .uri("lb://media-service"))

                // Recordings — yêu cầu JWT
                .route("media-recordings", r -> r
                        .path("/api/livekit/recordings/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(false))))
                        .uri("lb://media-service"))

                // === CHAT SERVICE ===
                // REST API (history, count)
                .route("chat-service-rest", r -> r
                        .path("/api/chat/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(false))))
                        .uri("lb://chat-service"))

                // WebSocket/STOMP
                .route("chat-service-ws", r -> r
                        .path("/ws/**")
                        .filters(f -> f.filter(jwtAuthFilterFactory.apply(
                                new JwtAuthFilterFactory.Config(true))))  // userId via query param
                        .uri("lb:ws://chat-service"))

                .build();
    }
}
