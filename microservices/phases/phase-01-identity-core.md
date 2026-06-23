# Phase 01 — Identity Service: Core (Register, Login, JWT, Redis)

## Mục Tiêu
Xây dựng Identity Service với các chức năng cốt lõi nhất: đăng ký, đăng nhập bằng email/password, phát hành JWT, quản lý Refresh Token và Password Reset Token trong Redis.

**Kết quả sau phase này**: Identity Service chạy ở port 8081, đăng ký vào Eureka, các endpoint register/login hoạt động, JWT được cấp đúng, refresh token lưu vào Redis.

---

## Tài Liệu Cần Đọc Trước

- `microservices/00-project-overview.md` — ErrorCode, ApiResponse, Response format
- `microservices/02-identity-service.md` — Toàn bộ đặc tả Identity Service
- `microservices/07-database-design.md` — Schema bảng `users`

---

## Dependencies (pom.xml của identity-service)

```xml
<dependencies>
  <!-- Web -->
  <dependency>spring-boot-starter-web</dependency>
  <dependency>spring-boot-starter-validation</dependency>

  <!-- Database -->
  <dependency>spring-boot-starter-data-jpa</dependency>
  <dependency>mysql-connector-j (runtime)</dependency>

  <!-- Redis -->
  <dependency>spring-boot-starter-data-redis</dependency>

  <!-- Security -->
  <dependency>spring-boot-starter-security</dependency>

  <!-- JWT -->
  <dependency>io.jsonwebtoken:jjwt-api:0.12.x</dependency>
  <dependency>io.jsonwebtoken:jjwt-impl:0.12.x (runtime)</dependency>
  <dependency>io.jsonwebtoken:jjwt-jackson:0.12.x (runtime)</dependency>

  <!-- Service Discovery -->
  <dependency>spring-cloud-starter-netflix-eureka-client</dependency>

  <!-- Common library -->
  <dependency>com.ptitmeet:common:1.0.0-SNAPSHOT</dependency>

  <!-- Utilities -->
  <dependency>lombok</dependency>
  <dependency>mapstruct</dependency>
  <dependency>spring-boot-starter-actuator</dependency>
</dependencies>
```

---

## Cấu Trúc Thư Mục Cần Tạo

```
identity-service/
├── pom.xml
└── src/main/
    ├── java/com/ptitmeet/identity/
    │   ├── IdentityServiceApplication.java
    │   ├── config/
    │   │   ├── SecurityConfig.java          ← Tắt Spring Security mặc định, chỉ cho phép các endpoint cần thiết
    │   │   ├── RedisConfig.java             ← Cấu hình RedisTemplate<String, String>
    │   │   └── JwtProperties.java           ← @ConfigurationProperties("jwt")
    │   ├── entity/
    │   │   └── User.java                    ← @Entity bảng users
    │   ├── repository/
    │   │   └── UserRepository.java
    │   ├── dto/
    │   │   ├── request/
    │   │   │   ├── RegisterRequest.java
    │   │   │   └── LoginRequest.java
    │   │   └── response/
    │   │       ├── UserResponse.java
    │   │       └── AuthResponse.java
    │   ├── mapper/
    │   │   └── UserMapper.java              ← MapStruct
    │   ├── service/
    │   │   ├── AuthService.java
    │   │   └── JwtService.java
    │   └── controller/
    │       └── AuthController.java
    └── resources/
        ├── application.yml
        └── application-local.yml
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn là một Java Spring Boot developer. Nhiệm vụ là tạo Phase 01 của Identity Service cho dự án PTITMeet Microservices.

**LƯU Ý QUAN TRỌNG**:
- Module `common` đã được tạo ở Phase 00, dùng trực tiếp các class: ApiResponse, ErrorCode, AppException, GlobalExceptionHandler.
- Đừng tạo lại các class đó trong module này.
- Dùng Java 21.

### CẤU HÌNH (application.yml)

```yaml
server:
  port: 8081

spring:
  application:
    name: identity-service
  datasource:
    url: jdbc:mysql://${MYSQL_IDENTITY_HOST:localhost}:${MYSQL_IDENTITY_PORT:3307}/ptitmeet_identity_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC
    username: root
    password: ${MYSQL_ROOT_PASSWORD:ptitmeet_root_pass}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQLDialect
        format_sql: true
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:ptitmeet_redis_pass}
      timeout: 2000ms

eureka:
  client:
    service-url:
      defaultZone: http://${EUREKA_HOST:localhost}:8761/eureka/
    register-with-eureka: true
    fetch-registry: true
  instance:
    prefer-ip-address: true
    instance-id: ${spring.application.name}:${server.port}

jwt:
  secret: ${JWT_SECRET:default-secret-key-change-in-production-min-256-bit}
  access-token-expiration: 1800000      # 30 phút (ms)
  refresh-token-expiration: 2592000     # 30 ngày (giây) - dùng cho Redis TTL
  reset-token-expiration: 900           # 15 phút (giây) - dùng cho Redis TTL

management:
  endpoints:
    web:
      exposure:
        include: health,info
```

### ENTITY: User

```java
@Entity
@Table(name = "users")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
    private String userId;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_provider", nullable = false)
    @Builder.Default
    private AuthProvider authProvider = AuthProvider.LOCAL;

    @Column(name = "provider_id")
    private String providerId;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum AuthProvider { LOCAL, GOOGLE }
}
```

### DTO: Request

**RegisterRequest.java** (với @Valid annotations):
```java
public class RegisterRequest {
    @NotBlank @Email(regexp = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", message = "Email không hợp lệ")
    private String email;

    @NotBlank @Size(min = 2, max = 100, message = "Họ tên phải từ 2 đến 100 ký tự")
    private String fullName;

    @NotBlank @Size(min = 8, message = "Mật khẩu phải có ít nhất 8 ký tự")
    private String password;
}
```

**LoginRequest.java**:
```java
public class LoginRequest {
    @NotBlank @Email
    private String email;

    @NotBlank
    private String password;
}
```

### DTO: Response

**UserResponse.java**: userId, email, fullName, avatarUrl, authProvider

**AuthResponse.java**: accessToken, refreshToken, user (UserResponse)

### SERVICE: JwtService

Implement đầy đủ:
1. `generateAccessToken(String userId, String email)` → JWT với claims: sub=userId, email=email, jti=UUID.randomUUID(), iat=now, exp=now+30min
2. `generateRefreshToken()` → UUID.randomUUID().toString()
3. `validateToken(String token)` → parse JWT, throw AppException(JWT_EXPIRED) nếu hết hạn, throw AppException(UNAUTHORIZED) nếu invalid
4. `extractUserId(String token)` → lấy claim "sub"
5. `extractEmail(String token)` → lấy claim "email"
6. `extractJti(String token)` → lấy claim "jti"
7. `getRemainingTtlSeconds(String token)` → (exp - now) in seconds

### SERVICE: RedisTokenService

Inject `StringRedisTemplate`. Implement:
1. `saveRefreshToken(String userId, String rawToken)`:
   - key = "auth:refresh:" + userId + ":" + sha256(rawToken)
   - value = userId
   - TTL = jwt.refresh-token-expiration (seconds)

2. `validateAndDeleteRefreshToken(String userId, String rawToken)` → Boolean:
   - Tính key, kiểm tra EXISTS trong Redis
   - Nếu không có: throw AppException(REFRESH_TOKEN_INVALID)
   - Nếu có: DELETE key, return true

3. `saveResetToken(String rawToken, String userId)`:
   - key = "auth:reset:" + rawToken
   - value = userId
   - TTL = jwt.reset-token-expiration (seconds)

4. `getUserIdFromResetToken(String rawToken)` → String:
   - key = "auth:reset:" + rawToken
   - GET value, nếu null throw AppException(REFRESH_TOKEN_INVALID)
   - DELETE key (single-use)
   - return userId

5. `blacklistAccessToken(String jti, long ttlSeconds)`:
   - key = "auth:blacklist:" + jti
   - value = "1"
   - TTL = ttlSeconds

6. `isBlacklisted(String jti)` → Boolean:
   - EXISTS "auth:blacklist:" + jti

Helper: `sha256(String input)` → Hex string (dùng MessageDigest SHA-256)

### SERVICE: AuthService

Implement:

**register(RegisterRequest req)**:
1. Kiểm tra email đã tồn tại → throw AppException(EMAIL_ALREADY_EXISTS)
2. Hash password bằng BCryptPasswordEncoder
3. Tạo User entity, save
4. Return UserResponse (dùng UserMapper)

**login(LoginRequest req)**:
1. Tìm user theo email → throw AppException(USER_NOT_FOUND) nếu không có
2. Kiểm tra auth_provider == LOCAL → nếu GOOGLE throw AppException(FORBIDDEN) với message "Account uses Google login"
3. BCrypt verify password → throw AppException(UNAUTHORIZED) nếu sai
4. Generate access token + refresh token
5. Lưu refresh token vào Redis: `saveRefreshToken(userId, rawToken)`
6. Return AuthResponse

### CONTROLLER: AuthController

Base path: `/api/auth`

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(ApiResponse.success(authService.register(req)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(req)));
    }
}
```

### SECURITY CONFIG

Dùng Spring Security nhưng chỉ để PasswordEncoder, KHÔNG filter JWT ở service con:
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll()); // Gateway đã handle auth
        return http.build();
    }
}
```

### REDIS CONFIG

```java
@Configuration
public class RedisConfig {
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
```

### MAPPER: UserMapper

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(source = "userId", target = "userId")
    UserResponse toUserResponse(User user);
}
```

### KIỂM TRA KẾT QUẢ

Test với curl/Postman:
1. POST /api/auth/register với body hợp lệ → trả UserResponse, code 1000
2. POST /api/auth/register với email đã tồn tại → code 4091
3. POST /api/auth/register với password < 8 ký tự → code 4000 + field errors
4. POST /api/auth/login đúng → trả AuthResponse với accessToken + refreshToken
5. POST /api/auth/login sai password → code 4010
6. Kiểm tra Eureka dashboard: http://localhost:8761 → identity-service phải hiện
7. Kiểm tra Redis: `redis-cli keys "auth:refresh:*"` → có key sau khi login
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- Register (LOCAL)
- Login (LOCAL, email + password)
- JWT generation (access + refresh)
- Redis: refresh token + blacklist
- Eureka registration

❌ KHÔNG làm trong phase này:
- Google OAuth (Phase 02)
- Forgot/Reset Password (Phase 02)
- User Profile CRUD (Phase 02)
- Refresh Token endpoint (Phase 02)
- Logout endpoint (Phase 02)
- Internal API endpoints cho service khác (Phase 02)
