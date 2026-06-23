# 02. Identity Service — Đặc Tả Chi Tiết

**Port**: 8081  
**Database**: MySQL — `ptitmeet_identity_db`  
**Cache/Token Store**: Redis  
**Vai trò**: Quản lý toàn bộ vòng đời tài khoản người dùng, xác thực, và phát sinh JWT Token.

---

## 1. Trách Nhiệm

| Chức năng | Mô tả |
|---|---|
| Đăng ký | Tạo tài khoản mới với email + password (bcrypt hash) |
| Đăng nhập | Xác thực credentials, trả về Access Token + Refresh Token |
| Đăng nhập Google | Xác thực `idToken` Google, tạo/link tài khoản |
| Quên mật khẩu | Gửi email kèm reset link (token 1 lần dùng) |
| Đặt lại mật khẩu | Validate reset token, cập nhật password mới |
| Đăng xuất | Revoke Refresh Token |
| Refresh Token | Cấp lại Access Token mới khi hết hạn |
| Xem hồ sơ | Trả về thông tin user hiện tại |
| Cập nhật hồ sơ | Cập nhật `fullName`, `avatarUrl` |
| Upload avatar | Upload ảnh đại diện |

---

## 2. Database Schema — `ptitmeet_identity_db` (MySQL)

### Bảng `users`

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `user_id` | UUID | PK, NOT NULL | Định danh duy nhất |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email đăng nhập |
| `password_hash` | VARCHAR(255) | NULLABLE | NULL nếu đăng nhập Google |
| `full_name` | VARCHAR(100) | NOT NULL | Họ và tên (2–100 ký tự) |
| `avatar_url` | TEXT | NULLABLE | URL ảnh đại diện |
| `auth_provider` | ENUM | NOT NULL | `LOCAL` hoặc `GOOGLE` |
| `provider_id` | VARCHAR(255) | NULLABLE | Google sub ID (nếu auth_provider=GOOGLE) |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo tài khoản |

---

## 3. Redis Token Store

Thay vì tạo bảng MySQL cho `refresh_tokens` và `password_reset_tokens`, hệ thống dùng **Redis** để lưu trữ token ngắn hạn:
- Đơn giản, tự động TTL expiry — không cần job dọn rác.
- Hiệu năng cao khi lookup token.
- Phù hợp với bản chất tạm thời của các token này.

### Redis Key Patterns

| Key | Value | TTL | Mô tả |
|---|---|---|---|
| `auth:refresh:{userId}:{tokenHash}` | `userId` (String) | 30 ngày | Refresh token của user. Dung `tokenHash` làm phần key để support multi-device |
| `auth:reset:{token}` | `userId` (String) | 15 phút | Password reset token, giá trị là userId cần reset |
| `auth:blacklist:{jti}` | `"1"` | TTL bằng thời gian sống còn lại của JWT | JWT bị revoke (logout) — blacklist pattern |

### Mô Tả Chi Tiết

#### Refresh Token
```
Key: auth:refresh:{userId}:{sha256(rawToken)}
Value: {userId}
TTL: 2592000 giây (30 ngày)

Flow:
  Login  → sinh UUID nguyên, hash SHA-256, lưu key vào Redis, trả UUID nguyên cho client
  Refresh → client gửi UUID → hash SHA-256 → tìm key trong Redis
           → nếu tồn tại: xoá key cũ, tạo cặp token mới (rotation)
           → nếu không: trả lỗi 4012 REFRESH_TOKEN_INVALID
  Logout  → xoá key Redis của refresh token đó
```

#### Password Reset Token
```
Key: auth:reset:{uuidToken}
Value: {userId}
TTL: 900 giây (15 phút)

Flow:
  Forgot password  → sinh UUID → lưu vào Redis với TTL=900s
                   → gửi email chứa link: /reset-password?token={UUID}
  Reset password   → người dùng gửi {UUID} lên
                   → lookup Redis: nếu có key → lấy userId, cập nhật password
                   → xoá key khỏi Redis (single-use)
                   → nếu key hết hạn/không tồn tại: trả lỗi 4012
```

#### JWT Blacklist (Logout)
```
Key: auth:blacklist:{jti}   ← jti = JWT ID claim (phải thêm vào JWT payload)
Value: "1"
TTL: thời gian sống còn lại của JWT (exp - now)

Flow:
  Logout → lấy jti từ JWT hiện tại → lưu vào blacklist Redis
  API Gateway verify → sau khi verify signature, check key auth:blacklist:{jti} trong Redis
                     → nếu tồn tại: từ chối 401
```

### Cấu Hình Redis Connection

```yaml
# application.yml của Identity Service
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
      timeout: 2000ms
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
```

---

## 3. JWT Token Design

### Access Token
- **Thuật toán**: HS256 (HMAC SHA-256) với Shared Secret Key.
- **Thời gian sống**: 15–30 phút (ngắn, stateless).
- **Claims bắt buộc**:
  ```json
  {
    "sub": "<userId-UUID>",
    "email": "user@example.com",
    "iat": 1718500000,
    "exp": 1718501800
  }
  ```
- **Shared Secret Key**: Được chia sẻ giữa Identity Service (ký) và API Gateway (verify). Các service con KHÔNG cần key này.

### Refresh Token
- **Dạng**: UUID random, **lưu vào Redis** (key: `auth:refresh:{userId}:{tokenHash}`) thay vì DB.
- **Thời gian sống**: 30 ngày (TTL tự động trong Redis).
- **Cơ chế**: Token rotation — mỗi refresh thành công xoá key cũ, cấp cặp token mới.

---

## 4. API Endpoints

**Base path**: `/api/auth`, `/api/users`  
*(Tất cả route này Gateway sẽ forward về Identity Service)*

### Auth Endpoints

| Method | Path | Auth Required | Mô tả |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Đăng ký tài khoản mới |
| `POST` | `/api/auth/login` | ❌ | Đăng nhập email/password |
| `POST` | `/api/auth/google` | ❌ | Đăng nhập bằng Google ID Token |
| `POST` | `/api/auth/logout` | ✅ | Đăng xuất, revoke refresh token |
| `POST` | `/api/auth/refresh-token` | ❌ (Refresh Token in cookie/body) | Làm mới Access Token |
| `POST` | `/api/auth/forgot-password` | ❌ | Yêu cầu email đặt lại mật khẩu |
| `POST` | `/api/auth/reset-password` | ❌ | Đặt lại mật khẩu bằng reset token |

### User Endpoints

| Method | Path | Auth Required | Mô tả |
|---|---|---|---|
| `GET` | `/api/users/me` | ✅ | Lấy thông tin user hiện tại |
| `GET` | `/api/users/profile` | ✅ | Alias của `/me` |
| `PUT` | `/api/users/profile` | ✅ | Cập nhật `fullName`, `avatarUrl` |
| `POST` | `/api/users/avatar` | ✅ | Upload ảnh đại diện |

---

## 5. Request / Response Chi Tiết

### `POST /api/auth/register`
```json
// Request
{
  "fullName": "Nguyễn Văn A",
  "email": "user@example.com",
  "password": "Password123"
}

// Response
{
  "code": 200,
  "message": "Success",
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": null,
    "authProvider": "LOCAL"
  }
}
```

### `POST /api/auth/login`
```json
// Request
{
  "email": "user@example.com",
  "password": "Password123"
}

// Response
{
  "code": 200,
  "message": "Success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "uuid-random-string",
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "fullName": "Nguyễn Văn A",
      "avatarUrl": "https://...",
      "authProvider": "LOCAL"
    }
  }
}
```

### `POST /api/auth/google`
```json
// Request
{
  "idToken": "google-id-token-string"
}
// Response: tương tự login
```

---

## 6. Validation Rules

| Field | Rule |
|---|---|
| `email` | Regex: `^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`, NOT NULL |
| `password` | Tối thiểu 8 ký tự |
| `fullName` | 2–100 ký tự, NOT NULL |
| `avatarUrl` | URL hợp lệ, NULLABLE |

---

## 7. Business Rules

1. **Email duy nhất**: Không cho phép 2 tài khoản cùng email (dù provider khác nhau).
2. **Google link**: Nếu email đã tồn tại với `LOCAL`, đăng nhập Google sẽ link vào account đó (hoặc báo lỗi — tùy quyết định thiết kế).
3. **Password hash**: Dùng BCrypt với strength phù hợp (cost ≥ 10).
4. **Reset token**: Lưu vào Redis với TTL = 15 phút, chỉ dùng 1 lần (xoá sau khi dùng). Token mới ghi đè key cũ nếu cùng userId.
5. **Refresh token rotation**: Mỗi lần refresh thành công → xoá key Redis cũ, tạo cặp token mới và lưu key mới vào Redis.
6. **Logout**: Thêm `jti` của JWT vào Redis blacklist với TTL = thời gian sống còn lại của JWT.

---

## 8. Internal API (Được gọi bởi Service Khác)

Identity Service có thể expose API nội bộ để các service khác tra cứu thông tin user khi cần:

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/internal/users/{userId}` | Lấy `fullName`, `avatarUrl`, `email` theo userId (để Meeting Service hiển thị thông tin host) |
| `GET` | `/internal/users/batch` | Lấy thông tin nhiều userId cùng lúc |

> **Lưu ý**: Các endpoint `/internal/**` chỉ được gọi từ nội bộ network, không expose ra Gateway.
