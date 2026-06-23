package com.ptitmeet.identity.service;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.identity.config.JwtProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisTokenService {

    private final StringRedisTemplate stringRedisTemplate;
    private final JwtProperties jwtProperties;

    public String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public void saveRefreshToken(String userId, String rawToken) {
        String key = "auth:refresh:" + sha256(rawToken);
        stringRedisTemplate.opsForValue().set(key, userId, jwtProperties.getRefreshTokenExpiration(), TimeUnit.SECONDS);
    }

    public String getUserIdFromRefreshToken(String rawToken) {
        String key = "auth:refresh:" + sha256(rawToken);
        return stringRedisTemplate.opsForValue().get(key);
    }

    public void deleteRefreshToken(String hashedToken) {
        stringRedisTemplate.delete("auth:refresh:" + hashedToken);
    }

    public void saveResetToken(String rawToken, String userId) {
        String key = "auth:reset:" + rawToken;
        stringRedisTemplate.opsForValue().set(key, userId, jwtProperties.getResetTokenExpiration(), TimeUnit.SECONDS);
    }

    public String getUserIdFromResetToken(String rawToken) {
        String key = "auth:reset:" + rawToken;
        String userId = stringRedisTemplate.opsForValue().get(key);
        if (userId == null) {
            throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        stringRedisTemplate.delete(key);
        return userId;
    }

    public void blacklistAccessToken(String jti, long ttlSeconds) {
        String key = "auth:blacklist:" + jti;
        stringRedisTemplate.opsForValue().set(key, "1", ttlSeconds, TimeUnit.SECONDS);
    }

    public Boolean isBlacklisted(String jti) {
        return stringRedisTemplate.hasKey("auth:blacklist:" + jti);
    }
}
