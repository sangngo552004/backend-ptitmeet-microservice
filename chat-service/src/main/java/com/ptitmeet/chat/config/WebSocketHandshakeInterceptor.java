package com.ptitmeet.chat.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Extracts userId and userName from HTTP headers / query params at WebSocket handshake time,
 * then stores them in session attributes for use in @MessageMapping handlers.
 */
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) throws Exception {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            String userId = httpRequest.getHeader("X-User-Id");
            if (userId == null) {
                userId = httpRequest.getParameter("userId");
            }
            if (userId != null) {
                attributes.put("userId", userId);
            }
            String userName = httpRequest.getHeader("X-User-Name");
            if (userName == null) {
                userName = httpRequest.getParameter("userName");
            }
            attributes.put("userName", userName != null ? userName : "Unknown");
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                WebSocketHandler wsHandler, Exception exception) {}
}
