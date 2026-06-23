# 06. API Gateway — Đặc Tả Chi Tiết

**Port**: 8080  
**Công nghệ**: Spring Cloud Gateway  
**Vai trò**: Cổng ngõ duy nhất của toàn bộ hệ thống. Thực hiện xác thực tập trung và định tuyến request.

---

## 1. Trách Nhiệm

| Chức năng | Mô tả |
|---|---|
| Định tuyến (Routing) | Forward request tới đúng service dựa trên URL prefix |
| Xác thực JWT tập trung | Verify chữ ký JWT, từ chối request không hợp lệ |
| Inject User Identity | Thêm `X-User-Id` và `X-User-Email` vào request header |
| WebSocket Proxy | Passthrough kết nối WebSocket tới Chat Service |
| Rate Limiting | (Tùy chọn) Giới hạn request rate |
| CORS | Xử lý CORS tập trung cho toàn hệ thống |

---

## 2. Routing Configuration

```yaml
spring:
  cloud:
    gateway:
      routes:
        # ─── Identity Service ───────────────────────────────
        - id: identity-service-auth
          uri: http://identity-service:8081
          predicates:
            - Path=/api/auth/**
          filters:
            - name: JwtAuthFilter
              args:
                skipAuth: true   # Không yêu cầu JWT cho auth endpoints

        - id: identity-service-users
          uri: http://identity-service:8081
          predicates:
            - Path=/api/users/**
          filters:
            - JwtAuthFilter   # Yêu cầu JWT

        # ─── Meeting Service ────────────────────────────────
        - id: meeting-service
          uri: http://meeting-service:8082
          predicates:
            - Path=/api/meetings/**
          filters:
            - JwtAuthFilter

        # ─── Media Service ──────────────────────────────────
        - id: media-service-recordings
          uri: http://media-service:8084
          predicates:
            - Path=/api/livekit/recordings/**
          filters:
            - JwtAuthFilter

        - id: media-service-webhook
          uri: http://media-service:8084
          predicates:
            - Path=/api/livekit/webhook
          filters:
            - name: JwtAuthFilter
              args:
                skipAuth: true   # Webhook từ LiveKit không có JWT

        # ─── Chat Service (WebSocket) ───────────────────────
        - id: chat-service-ws
          uri: ws://chat-service:8083
          predicates:
            - Path=/ws/**
          filters:
            - name: WsJwtAuthFilter
              args:
                injectHeaders: true
```

---

## 3. JWT Auth Filter — Logic Chi Tiết

```java
// Pseudo-code của JwtAuthFilter
public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    // 1. Lấy token từ Authorization header
    String token = extractBearerToken(exchange.getRequest());
    
    // 2. Nếu route được đánh dấu skipAuth → cho qua
    if (isSkipAuthRoute(exchange)) {
        return chain.filter(exchange);
    }
    
    // 3. Không có token → 401 Unauthorized
    if (token == null) {
        return unauthorized(exchange);
    }
    
    // 4. Verify chữ ký JWT bằng Shared Secret
    Claims claims = jwtUtil.verifyAndExtract(token);
    // → Nếu expired hoặc invalid signature → 401
    
    // 5. Inject claims vào request headers
    ServerWebExchange mutatedExchange = exchange.mutate()
        .request(r -> r
            .header("X-User-Id", claims.getSubject())        // userId UUID
            .header("X-User-Email", claims.get("email"))     // email
        )
        .build();
    
    // 6. Forward request đã có headers tới service đích
    return chain.filter(mutatedExchange);
}
```

**Shared Secret Key**: Phải khớp với key mà Identity Service dùng để sign token.  
Cấu hình trong `application.yml`:
```yaml
jwt:
  secret: ${JWT_SECRET}   # Load từ environment variable
  # Không cần expiration ở đây — chỉ verify, không ký
```

---

## 4. Các Route Không Cần JWT

| Endpoint | Lý do |
|---|---|
| `POST /api/auth/register` | Chưa có tài khoản |
| `POST /api/auth/login` | Đang đăng nhập |
| `POST /api/auth/google` | OAuth flow |
| `POST /api/auth/forgot-password` | Không cần đăng nhập |
| `POST /api/auth/reset-password` | Dùng reset token riêng |
| `POST /api/auth/refresh-token` | Dùng refresh token, không phải access token |
| `POST /api/livekit/webhook` | Callback từ LiveKit server, xác thực bằng webhook secret |

---

## 5. CORS Configuration

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        corsConfigurations:
          '[/**]':
            allowedOrigins:
              - "http://localhost:3000"   # React dev
              - "https://ptitmeet.com"    # Production
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
            allowedHeaders:
              - "*"
            allowCredentials: true
            maxAge: 3600
```

---

## 6. WebSocket Proxy cho Chat Service

- Gateway cấu hình route với scheme `ws://` hoặc `wss://` để proxy WebSocket.
- Khi client gửi WebSocket upgrade request tới `ws://gateway:8080/ws`, Gateway:
  1. Intercept HTTP upgrade request.
  2. Verify JWT từ query param `?token=` hoặc `Authorization` header (WebSocket handshake).
  3. Inject `X-User-Id` vào headers của upgrade request.
  4. Passthrough toàn bộ WebSocket connection tới `ws://chat-service:8083/ws`.
- Từ thời điểm upgrade xong, mọi STOMP frame đều được proxy trực tiếp — Gateway không xử lý frame.

---

## 7. Error Response Format

Gateway trả về lỗi theo format chuẩn:

```json
{
  "code": 401,
  "message": "UNAUTHORIZED",
  "data": null
}
```

| HTTP Status | code | Trường hợp |
|---|---|---|
| 401 | 401 | Không có token hoặc token invalid |
| 403 | 403 | Token hợp lệ nhưng không có quyền |
| 503 | 503 | Service đích không khả dụng |

---

## 8. Service Discovery (Giai đoạn học tập)

Trong giai đoạn học tập, sử dụng **hard-coded URL** hoặc Docker Compose service names:

```yaml
# application.yml của Gateway
services:
  identity: http://identity-service:8081
  meeting:  http://meeting-service:8082
  chat:     http://chat-service:8083
  media:    http://media-service:8084
```

> **Nâng cấp tương lai**: Có thể tích hợp Eureka Server hoặc Consul cho dynamic service discovery.

---

## 9. Health Check Endpoints

Gateway expose health check để monitor:

```
GET /actuator/health        → Trạng thái Gateway
GET /actuator/gateway/routes → Danh sách routes đang active
```
