package com.ptitmeet.identity.service;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.identity.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {

    private final JwtProperties jwtProperties;

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(String userId, String email) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .id(UUID.randomUUID().toString())
                .issuedAt(new Date(now))
                .expiration(new Date(now + jwtProperties.getAccessTokenExpiration()))
                .signWith(getSigningKey())
                .compact();
    }

    public String generateRefreshToken() {
        return UUID.randomUUID().toString();
    }

    public Claims validateToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new AppException(ErrorCode.JWT_EXPIRED);
        } catch (Exception e) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    public String extractUserId(String token) {
        return validateToken(token).getSubject();
    }

    public String extractEmail(String token) {
        return validateToken(token).get("email", String.class);
    }

    public String extractJti(String token) {
        return validateToken(token).getId();
    }

    public long getRemainingTtlSeconds(String token) {
        Claims claims = validateToken(token);
        long expirationMillis = claims.getExpiration().getTime();
        long nowMillis = System.currentTimeMillis();
        long diff = expirationMillis - nowMillis;
        return diff > 0 ? diff / 1000 : 0;
    }
}
