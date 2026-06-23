# Phase 03 — API Gateway

## Mục Tiêu
Xây dựng API Gateway với Spring Cloud Gateway: JWT verification filter, routing đến các service, WebSocket proxy cho Chat Service, CORS, và tích hợp Redis để check JWT blacklist.

**Kết quả sau phase này**: API Gateway chạy ở port 8080, tất cả routing hoạt động, JWT được verify và X-User-Id được inject.

---

## Tài Liệu Cần Đọc Trước

- `microservices/06-api-gateway.md` — Toàn bộ đặc tả Gateway
- `microservices/01-architecture.md` — Routing map, luồng request
- `microservices/00-project-overview.md` — Service Discovery (Eureka)

---

## Tiền Điều Kiện

- Phase 00: Eureka Server chạy
- Phase 01: Identity Service chạy (để test routing)
- JWT_SECRET phải khớp với Identity Service

---

## Dependencies (pom.xml của api-gateway)

```xml
<dependencies>
  <!-- Gateway (dùng WebFlux, KHÔNG dùng spring-boot-starter-web) -->
  <dependency>spring-cloud-starter-gateway</dependency>

  <!-- Service Discovery -->
  <dependency>spring-cloud-starter-netflix-eureka-client</dependency>

  <!-- Redis (kiểm tra JWT blacklist) -->
  <dependency>spring-boot-starter-data-redis-reactive</dependency>

  <!-- JWT -->
  <dependency>io.jsonwebtoken:jjwt-api:0.12.x</dependency>
  <dependency>io.jsonwebtoken:jjwt-impl:0.12.x (runtime)</dependency>
  <dependency>io.jsonwebtoken:jjwt-jackson:0.12.x (runtime)</dependency>

  <!-- Common -->
  <dependency>com.ptitmeet:common:1.0.0-SNAPSHOT</dependency>

  <dependency>lombok</dependency>
  <dependency>spring-boot-starter-actuator</dependency>
</dependencies>
```

**LƯU Ý**: Spring Cloud Gateway dùng WebFlux (reactive). KHÔNG add spring-boot-starter-web vào Gateway, sẽ conflict.

---

## Cấu Trúc Thư Mục

```
api-gateway/
├── pom.xml
└── src/main/
    ├── java/com/ptitmeet/gateway/
    │   ├── ApiGatewayApplication.java
    │   ├── config/
    │   │   ├── GatewayConfig.java        ← Route definitions programmatic
    │   │   ├── CorsConfig.java
    │   │   ├── JwtProperties.java
    │   │   └── ReactiveRedisConfig.java
    │   ├── filter/
    │   │   └── JwtAuthGatewayFilter.java ← GlobalFilter implement
    │   └── exception/
    │       └── GatewayExceptionHandler.java ← @ControllerAdvice cho WebFlux
    └── resources/
        └── application.yml
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang xây dựng API Gateway cho dự án PTITMeet Microservices. Gateway dùng Spring Cloud Gateway (WebFlux-based).

**QUAN TRỌNG**: Spring Cloud Gateway là reactive (WebFlux). Không dùng Servlet APIs. Không dùng HttpServletRequest. Dùng ServerWebExchange, Mono, Flux.

### CẤU HÌNH (application.yml)

```yaml
server:
  port: 8080

spring:
  application:
    name: api-gateway
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: 6379
      password: ${REDIS_PASSWORD:ptitmeet_redis_pass}
      timeout: 2000ms
  cloud:
    gateway:
      discovery:
        locator:
          enabled: false   # Tắt auto-discovery routing, dùng manual routes
      globalcors:
        corsConfigurations:
          '[/**]':
            allowedOriginPatterns:
              - "http://localhost:3000"
              - "http://localhost:5173"
              - "${FRONTEND_URL:http://localhost:3000}"
            allowedMethods: [GET, POST, PUT, DELETE, OPTIONS, PATCH]
            allowedHeaders: ["*"]
            allowCredentials: true
            maxAge: 3600

eureka:
  client:
    service-url:
      defaultZone: http://${EUREKA_HOST:localhost}:8761/eureka/
    register-with-eureka: true
    fetch-registry: true
  instance:
    prefer-ip-address: true

jwt:
  secret: ${JWT_SECRET:default-secret-key-change-in-production-min-256-bit}

management:
  endpoints:
    web:
      exposure:
        include: health,info,gateway

# Log level cho debug
logging:
  level:
    org.springframework.cloud.gateway: DEBUG
```

### ROUTE DEFINITIONS (GatewayConfig.java)

Dùng programmatic route builder (RouteLocatorBuilder):

```java
@Configuration
public class GatewayConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()

            // === IDENTITY SERVICE ===
            // Auth endpoints — skipAuth = true
            .route("identity-auth", r -> r
                .path("/api/auth/**")
                .filters(f -> f.filter(jwtAuthFilter.apply(
                    new JwtAuthGatewayFilter.Config(true))))  // skipAuth
                .uri("lb://identity-service"))

            // User endpoints — yêu cầu JWT
            .route("identity-users", r -> r
                .path("/api/users/**")
                .uri("lb://identity-service"))

            // Internal endpoints — chỉ từ nội bộ (không expose ra ngoài thực tế)
            // Trong dev, để qua nhưng nên chặn bằng IP filter nếu production
            .route("identity-internal", r -> r
                .path("/internal/**")
                .filters(f -> f.filter(jwtAuthFilter.apply(
                    new JwtAuthGatewayFilter.Config(true))))
                .uri("lb://identity-service"))

            // === MEETING SERVICE ===
            .route("meeting-service", r -> r
                .path("/api/meetings/**")
                .uri("lb://meeting-service"))

            // === MEDIA SERVICE ===
            // Webhook — skipAuth (LiveKit callback)
            .route("media-webhook", r -> r
                .path("/api/livekit/webhook")
                .filters(f -> f.filter(jwtAuthFilter.apply(
                    new JwtAuthGatewayFilter.Config(true))))
                .uri("lb://media-service"))

            // Recordings — yêu cầu JWT
            .route("media-recordings", r -> r
                .path("/api/livekit/recordings/**")
                .uri("lb://media-service"))

            // === CHAT SERVICE (WebSocket) ===
            .route("chat-service-ws", r -> r
                .path("/ws/**")
                .uri("lb:ws://chat-service"))  // scheme ws:// cho WebSocket

            .build();
    }
}
```

### JWT AUTH FILTER (JwtAuthGatewayFilter.java)

Implement `GatewayFilter` và `Ordered`:

```java
@Component
public class JwtAuthGatewayFilter implements GatewayFilter, Ordered {

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Config {
        private boolean skipAuth = false;
    }

    // Danh sách path không cần JWT (config skipAuth=true sẽ handle, đây là fallback)
    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/api/auth/register", "/api/auth/login", "/api/auth/google",
        "/api/auth/forgot-password", "/api/auth/reset-password",
        "/api/auth/refresh-token", "/api/livekit/webhook"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        // Nếu route đã đánh dấu skipAuth hoặc path là public → cho qua
        // (skipAuth được set qua Config khi define route)

        String authHeader = exchange.getRequest().getHeaders().getFirst("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return unauthorizedResponse(exchange);
        }

        String token = authHeader.substring(7);

        try {
            // 1. Verify JWT signature và expiry
            Claims claims = jwtService.validateAndExtract(token);
            String userId = claims.getSubject();
            String email = claims.get("email", String.class);
            String jti = claims.getId();

            // 2. Check blacklist trong Redis (reactive)
            return reactiveRedisTemplate.hasKey("auth:blacklist:" + jti)
                .flatMap(isBlacklisted -> {
                    if (isBlacklisted) {
                        return unauthorizedResponse(exchange);
                    }
                    // 3. Inject headers
                    ServerWebExchange mutated = exchange.mutate()
                        .request(r -> r
                            .header("X-User-Id", userId)
                            .header("X-User-Email", email)
                            .header("X-User-Jti", jti))
                        .build();
                    return chain.filter(mutated);
                });

        } catch (ExpiredJwtException e) {
            return errorResponse(exchange, 4011, "JWT_EXPIRED", HttpStatus.UNAUTHORIZED);
        } catch (JwtException e) {
            return errorResponse(exchange, 4010, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
        }
    }

    private Mono<Void> unauthorizedResponse(ServerWebExchange exchange) {
        return errorResponse(exchange, 4010, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }

    private Mono<Void> errorResponse(ServerWebExchange exchange, int code, String message, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = String.format("{\"code\":%d,\"message\":\"%s\",\"data\":null}", code, message);
        DataBuffer buffer = exchange.getResponse().bufferFactory()
            .wrap(body.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -1; // Chạy trước tất cả filter khác
    }
}
```

**Vấn đề với Config pattern**: Để truyền skipAuth từ route config vào filter, cần refactor thành AbstractGatewayFilterFactory. Implement như sau:

```java
@Component
public class JwtAuthFilterFactory extends AbstractGatewayFilterFactory<JwtAuthFilterFactory.Config> {

    public JwtAuthFilterFactory(...) {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            if (config.isSkipAuth()) {
                return chain.filter(exchange);
            }
            // ... logic verify JWT như trên
        };
    }

    @Data
    public static class Config {
        private boolean skipAuth = false;
    }
}
```

Đăng ký filter factory và inject vào route definition.

### REACTIVE REDIS CONFIG

```java
@Configuration
public class ReactiveRedisConfig {
    @Bean
    public ReactiveStringRedisTemplate reactiveStringRedisTemplate(
        ReactiveRedisConnectionFactory factory) {
        return new ReactiveStringRedisTemplate(factory);
    }
}
```

### GLOBAL EXCEPTION HANDLER (WebFlux)

```java
@Component
public class GatewayExceptionHandler implements ErrorWebExceptionHandler {
    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        // Xử lý tất cả exception không được catch ở filter
        // Trả về JSON format giống ApiResponse
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        String body = "{\"code\":5000,\"message\":\"GATEWAY_ERROR\",\"data\":null}";
        // ... write body to response
    }
}
```

### JWT PROPERTIES

```java
@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {
    private String secret;
}
```

JwtService trong Gateway chỉ cần validate + extract, không cần generate:
```java
@Service
public class GatewayJwtService {
    private final SecretKey secretKey;

    public GatewayJwtService(JwtProperties properties) {
        this.secretKey = Keys.hmacShaKeyFor(
            Decoders.BASE64.decode(properties.getSecret()));
    }

    public Claims validateAndExtract(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
```

**LƯU Ý**: JWT secret phải được encode BASE64 khi lưu trong env. Identity Service cũng phải dùng cùng cách encode.
Nếu secret chưa encode BASE64: dùng `Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))` ở cả 2 service (phải nhất quán).

### WEBSOCKET PROXY

Spring Cloud Gateway hỗ trợ WebSocket proxy native. Chỉ cần đặt scheme `ws://` hoặc `lb:ws://` trong uri là Gateway tự proxy WebSocket. Không cần config thêm.

Client kết nối: `ws://localhost:8080/ws?token=<access-token>` hoặc với header Authorization.

**Lưu ý**: WebSocket upgrade request vẫn đi qua JwtAuthFilter. Filter đọc token từ query param `token` hoặc Authorization header. Nếu dùng query param:
```java
// Trong filter, sau khi không tìm thấy Authorization header:
String tokenFromQuery = exchange.getRequest().getQueryParams().getFirst("token");
if (tokenFromQuery != null) token = tokenFromQuery;
```

### KIỂM TRA KẾT QUẢ

1. GET http://localhost:8080/api/users/me (không có token) → 401 JSON response
2. GET http://localhost:8080/api/users/me (với JWT hợp lệ) → forward tới identity-service
3. POST http://localhost:8080/api/auth/login → forward tới identity-service (không cần token)
4. Check Eureka: api-gateway phải đăng ký ở http://localhost:8761
5. Sau logout (JWT bị blacklist): GET /api/users/me với token cũ → 401

### CẤU HÌNH CORS

Đặt trong application.yml như trên. Spring Cloud Gateway handle CORS tự động qua GlobalCorsConfiguration.
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- JWT verification filter (signature + blacklist Redis)
- Route tới tất cả 4 service
- WebSocket proxy tới Chat Service
- CORS configuration
- Eureka registration

❌ KHÔNG làm trong phase này:
- Rate limiting
- Request/Response transformation nâng cao
- Không implement business logic nào
