# Phase 02 — Identity Service: Advanced Auth + Profile

## Mục Tiêu
Hoàn thiện Identity Service với: Google OAuth, Forgot/Reset Password (Redis), Refresh Token endpoint, Logout (JWT blacklist), User Profile CRUD, và Internal gRPC API để các service khác tra cứu user.

**Kết quả sau phase này**: Identity Service hoàn chỉnh 100% về chức năng auth và profile.

---

## Tài Liệu Cần Đọc Trước

- `microservices/02-identity-service.md` — Toàn bộ, đặc biệt phần Redis Token Store và Internal API
- `microservices/00-project-overview.md` — ErrorCode, ApiResponse

---

## Tiền Điều Kiện

Phase 01 đã hoàn thành. Module `identity-service` đã có:
- User entity + repository
- JwtService, RedisTokenService, AuthService (register + login)
- SecurityConfig, RedisConfig

---

## Dependencies Bổ Sung

Thêm vào `identity-service/pom.xml`:
```xml
<!-- Google OAuth -->
<dependency>com.google.api-client:google-api-client:2.2.0</dependency>
<dependency>com.google.oauth-client:google-oauth-client:1.34.1</dependency>

<!-- Email (JavaMailSender) -->
<dependency>spring-boot-starter-mail</dependency>

<!-- AWS S3 (cho upload avatar) -->
<dependency>software.amazon.awssdk:s3:2.21.x</dependency>
<dependency>software.amazon.awssdk:auth:2.21.x</dependency>
```

Thêm vào `application.yml`:
```yaml
google:
  client-id: ${GOOGLE_CLIENT_ID}

spring:
  mail:
    host: ${MAIL_HOST:smtp.gmail.com}
    port: ${MAIL_PORT:587}
    username: ${MAIL_USERNAME}
    password: ${MAIL_PASSWORD}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

aws:
  s3:
    bucket: ${AWS_S3_BUCKET:ptitmeet-recordings}
    region: ${AWS_S3_REGION:ap-southeast-1}
    access-key: ${AWS_ACCESS_KEY_ID}
    secret-key: ${AWS_SECRET_ACCESS_KEY}
    avatar-prefix: avatars/
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang tiếp tục từ Phase 01 của Identity Service. Nhiệm vụ là implement các tính năng nâng cao.

### BƯỚC 1: Google OAuth — loginWithGoogle(GoogleLoginRequest req)

**DTO GoogleLoginRequest**: field `idToken` (NotBlank)

**Logic trong AuthService.loginWithGoogle(req)**:
1. Verify Google ID Token:
   ```java
   GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
       new NetHttpTransport(), new GsonFactory())
       .setAudience(Collections.singletonList(googleClientId))
       .build();
   GoogleIdToken idToken = verifier.verify(req.getIdToken());
   if (idToken == null) throw new AppException(ErrorCode.UNAUTHORIZED);
   GoogleIdToken.Payload payload = idToken.getPayload();
   ```
2. Lấy: `email = payload.getEmail()`, `name = (String) payload.get("name")`, `sub = payload.getSubject()`, `picture = (String) payload.get("picture")`
3. Tìm user theo email:
   - Nếu tồn tại: update providerId nếu null, update avatarUrl nếu null
   - Nếu không tồn tại: tạo mới User với authProvider=GOOGLE, providerId=sub
4. Generate access + refresh token → return AuthResponse

**Endpoint**: POST /api/auth/google

### BƯỚC 2: Forgot Password

**DTO ForgotPasswordRequest**: field `email` (NotBlank, Email)

**Logic AuthService.forgotPassword(req)**:
1. Tìm user theo email → nếu không có throw AppException(USER_NOT_FOUND)
2. Sinh UUID token ngẫu nhiên
3. Lưu Redis: `redisTokenService.saveResetToken(token, userId)` — TTL 15 phút
4. Gửi email bằng JavaMailSender:
   - Subject: "PTITMeet — Đặt lại mật khẩu"
   - Body HTML chứa link: `{frontendUrl}/reset-password?token={token}`
   - Dùng `@Value("${app.frontend-url:http://localhost:3000}")` cho frontendUrl
5. Return void (chỉ trả success, không tiết lộ user có tồn tại hay không → nhưng theo test case thì báo lỗi nếu email không tồn tại)

Thêm vào application.yml:
```yaml
app:
  frontend-url: ${FRONTEND_URL:http://localhost:3000}
```

**Endpoint**: POST /api/auth/forgot-password

### BƯỚC 3: Reset Password

**DTO ResetPasswordRequest**: `token` (NotBlank), `newPassword` (NotBlank, Size min=8)

**Logic AuthService.resetPassword(req)**:
1. Lookup Redis: `userId = redisTokenService.getUserIdFromResetToken(req.getToken())`
   - Nếu không có (expired/invalid): throw AppException(REFRESH_TOKEN_INVALID)
   - Sau khi lấy, Redis tự xóa key (single-use, đã delete trong getUserIdFromResetToken)
2. Tìm user theo userId → hash newPassword bằng BCrypt → save
3. Return void

**Endpoint**: POST /api/auth/reset-password

### BƯỚC 4: Refresh Token Endpoint

**Logic AuthService.refreshToken(String rawRefreshToken)**:
1. Parse rawToken: extract userId từ format token (hoặc lưu userId trong Redis value)
   - Thực tế: cần biết userId để tạo Redis key → Client phải gửi cả userId và rawToken, hoặc encode userId trong rawToken
   - **Quyết định thiết kế**: Lưu Redis với key = "auth:refresh:" + sha256(rawToken) (không có userId prefix) và value = userId
   - Sửa lại RedisTokenService.saveRefreshToken() thành: key = "auth:refresh:" + sha256(rawToken), value = userId
2. Tính key = "auth:refresh:" + sha256(rawToken)
3. userId = Redis GET key → nếu null: throw AppException(REFRESH_TOKEN_INVALID)
4. DELETE key cũ (rotation)
5. Tìm user theo userId
6. Generate cặp token mới
7. Lưu refresh token mới vào Redis
8. Return AuthResponse

**Request**: POST /api/auth/refresh-token, Body: `{ "refreshToken": "raw-uuid-string" }`
**DTO RefreshTokenRequest**: field `refreshToken` (NotBlank)

### BƯỚC 5: Logout Endpoint

**Logic AuthService.logout(String accessToken, String rawRefreshToken)**:
1. Parse jti từ accessToken (dùng JwtService.extractJti)
2. Lấy TTL còn lại (dùng JwtService.getRemainingTtlSeconds)
3. Thêm jti vào Redis blacklist: `redisTokenService.blacklistAccessToken(jti, ttlSeconds)`
4. Nếu rawRefreshToken không null: xóa refresh token khỏi Redis: `redisTokenService.deleteRefreshToken(sha256(rawRefreshToken))`

Bổ sung trong RedisTokenService:
- `deleteRefreshToken(String hashedToken)` → DELETE "auth:refresh:" + hashedToken

Controller nhận accessToken từ Authorization header (cần tự parse), và refreshToken từ request body (optional).
**Endpoint**: POST /api/auth/logout
**Request body**: `{ "refreshToken": "..." }` (optional)
Controller phải đọc Authorization header: `request.getHeader("Authorization")`.substring("Bearer ".length())

### BƯỚC 6: User Profile Endpoints

**DTO UpdateProfileRequest**: `fullName` (NotBlank, Size 2-100), `avatarUrl` (nullable)

**UserService** (tạo mới):
- `getProfile(String userId)` → UserResponse
- `updateProfile(String userId, UpdateProfileRequest req)` → UserResponse
- `uploadAvatar(String userId, MultipartFile file)` → UserResponse

**uploadAvatar logic**:
1. Validate file: chỉ chấp nhận image/jpeg, image/png, image/webp, max 5MB
2. Upload lên S3:
   - Key: "avatars/{userId}/{UUID}.{ext}"
   - Dùng AWS SDK v2: `S3Client.putObject(...)`
3. Tạo URL: `https://{bucket}.s3.{region}.amazonaws.com/{key}`
4. Update user.avatarUrl = url, save, return UserResponse

**S3Config**:
```java
@Configuration
public class S3Config {
    @Bean
    public S3Client s3Client(
        @Value("${aws.s3.region}") String region,
        @Value("${aws.s3.access-key}") String accessKey,
        @Value("${aws.s3.secret-key}") String secretKey
    ) {
        return S3Client.builder()
            .region(Region.of(region))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey)))
            .build();
    }
}
```

**UserController**:
```
GET  /api/users/me            → getProfile (đọc X-User-Id header)
GET  /api/users/profile       → getProfile (alias)
PUT  /api/users/profile       → updateProfile
POST /api/users/avatar        → uploadAvatar (multipart/form-data, field "file")
```

Lấy userId từ header: `request.getHeader("X-User-Id")`

### BƯỚC 7: Internal API Endpoint (cho các service khác gọi)

Tạo InternalUserController (base path: /internal):
```
GET /internal/users/{userId}        → UserResponse (không qua Gateway)
POST /internal/users/batch          → List<UserResponse>, body: List<String> userIds
```

**Lưu ý**: Endpoint /internal/** sẽ không được expose ra Gateway. Chỉ service khác trong Docker network mới gọi được. Không cần auth check.

### BƯỚC 8: Cập Nhật Eureka Gateway Check (API Gateway cần verify blacklist)

API Gateway cần gọi Redis để check blacklist. Nhưng thay vì gọi, Gateway sẽ kết nối Redis trực tiếp (cùng Redis instance). Chỉ cần document Redis key pattern:
- "auth:blacklist:{jti}" → nếu tồn tại, JWT bị revoke

### KIỂM TRA KẾT QUẢ

1. POST /api/auth/google với idToken hợp lệ → AuthResponse
2. POST /api/auth/forgot-password → email được gửi, Redis có key auth:reset:*
3. POST /api/auth/reset-password với token hợp lệ → 200, sau đó token không dùng lại được
4. POST /api/auth/refresh-token → cặp token mới, token cũ không dùng được
5. POST /api/auth/logout → Redis blacklist có jti
6. GET /api/users/me (header X-User-Id: uuid) → UserResponse
7. PUT /api/users/profile → updated UserResponse
8. GET /internal/users/{userId} → UserResponse
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- Google OAuth
- Forgot/Reset Password
- Refresh Token endpoint
- Logout với JWT blacklist
- User Profile CRUD
- Avatar upload lên S3
- Internal API /internal/users/**

❌ KHÔNG làm trong phase này:
- gRPC server cho Identity Service (Phase 10)
- Bất kỳ service nào khác
