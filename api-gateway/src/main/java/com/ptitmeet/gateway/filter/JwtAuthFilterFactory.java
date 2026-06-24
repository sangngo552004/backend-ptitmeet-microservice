package com.ptitmeet.gateway.filter;

import com.ptitmeet.gateway.config.GatewayJwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import lombok.Data;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Component
public class JwtAuthFilterFactory extends AbstractGatewayFilterFactory<JwtAuthFilterFactory.Config> {

    private final GatewayJwtService jwtService;
    private final ReactiveStringRedisTemplate reactiveRedisTemplate;

    public JwtAuthFilterFactory(GatewayJwtService jwtService, ReactiveStringRedisTemplate reactiveRedisTemplate) {
        super(Config.class);
        this.jwtService = jwtService;
        this.reactiveRedisTemplate = reactiveRedisTemplate;
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            if (config.isSkipAuth()) {
                return chain.filter(exchange);
            }

            // Bỏ qua check token đối với các request OPTIONS (CORS preflight)
            if (exchange.getRequest().getMethod().name().equals("OPTIONS")) {
                return chain.filter(exchange);
            }

            String token = null;
            String authHeader = exchange.getRequest().getHeaders().getFirst("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            } else {
                String tokenFromQuery = exchange.getRequest().getQueryParams().getFirst("token");
                if (tokenFromQuery != null) {
                    token = tokenFromQuery;
                }
            }

            if (token == null) {
                System.out.println("Missing Authorization header or token query parameter");
                return errorResponse(exchange, 4012, "MISSING_TOKEN", HttpStatus.UNAUTHORIZED);
            }

            try {
                Claims claims = jwtService.validateAndExtract(token);
                String userId = claims.getSubject();
                String email = claims.get("email", String.class);
                String jti = claims.getId();
                return reactiveRedisTemplate.hasKey("auth:blacklist:" + jti)
                        .flatMap(isBlacklisted -> {
                            if (Boolean.TRUE.equals(isBlacklisted)) {
                                return errorResponse(exchange, 4013, "TOKEN_BLACKLISTED", HttpStatus.UNAUTHORIZED);
                            }
                            
                            ServerWebExchange mutated = exchange.mutate()
                                    .request(r -> r
                                            .header("X-User-Id", userId)
                                            .header("X-User-Email", email)
                                            .header("X-User-Jti", jti))
                                    .build();
                            return chain.filter(mutated);
                        });

            } catch (ExpiredJwtException e) {
                System.out.println("JWT expired: " + e.getMessage());
                return errorResponse(exchange, 4011, "JWT_EXPIRED", HttpStatus.UNAUTHORIZED);
            } catch (JwtException e) {
                System.out.println("JWT validation error: " + e.getMessage());
                return errorResponse(exchange, 4010, "INVALID_TOKEN: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
            }
        };
    }

    private Mono<Void> unauthorizedResponse(ServerWebExchange exchange) {
        return errorResponse(exchange, 4010, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }

    private Mono<Void> errorResponse(ServerWebExchange exchange, int code, String message, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = String.format("{\"code\":%d,\"message\":\"%s\",\"data\":null}", code, message);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Data
    public static class Config {
        private boolean skipAuth = false;
        
        public Config() {}
        
        public Config(boolean skipAuth) {
            this.skipAuth = skipAuth;
        }
    }
}
