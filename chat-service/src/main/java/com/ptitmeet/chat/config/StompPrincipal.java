package com.ptitmeet.chat.config;

import java.security.Principal;

/**
 * Simple Principal implementation backed by userId string.
 * Used by StompChannelInterceptor so that convertAndSendToUser() resolves correctly.
 */
public record StompPrincipal(String name) implements Principal {
    @Override
    public String getName() {
        return name;
    }
}
