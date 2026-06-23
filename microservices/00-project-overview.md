# PTITMeet Microservices — Tổng Quan Dự Án

> **Phiên bản tài liệu**: 1.1  
> **Ngày tạo**: 2026-06-16  
> **Cập nhật lần cuối**: 2026-06-16  
> **Mục đích**: Cơ sở lý thuyết dùng cho mọi agent/session phát triển tiếp dự án PTITMeet Microservices.

---

## Giới Thiệu

PTITMeet là ứng dụng họp trực tuyến được chuyển thể từ kiến trúc Monolith sang Microservices.  
Hệ thống sử dụng **LiveKit** làm media infrastructure (SFU/WebRTC) và tự xây dựng toàn bộ nghiệp vụ.

**Nguyên tắc cốt lõi khi chuyển đổi**:
- Mỗi service sở hữu database riêng biệt (**Database per Service** pattern).
- Không còn khóa ngoại cứng giữa các service — liên kết bằng **Raw UUID** (loose coupling).
- Mọi request từ client đi qua một cổng duy nhất: **API Gateway**.

---

## Cấu Trúc Service

| Service | Port | Công nghệ DB | Vai trò chính |
|---|---|---|---|
| **API Gateway** | 8080 | Không có DB | Định tuyến, xác thực JWT tập trung, inject header |
| **Identity Service** | 8081 | MySQL (`ptitmeet_identity_db`) | Đăng ký, đăng nhập, ký phát JWT, quản lý hồ sơ |
| **Meeting Service** | 8082 | MySQL (`ptitmeet_meeting_db`) | Tạo phòng, lên lịch, quản lý thành viên, waiting room |
| **Chat Service** | 8083 | MongoDB (`ptitmeet_chat_db`) | Tin nhắn real-time và lịch sử chat |
| **Media Service** | 8084 | MySQL (`ptitmeet_media_db`) | Ghi hình (Recording), tích hợp LiveKit Egress, lưu trữ AWS S3 |

---

## Mục Lục Tài Liệu

```
docs/microservices/
├── 00-project-overview.md          ← File này (Index & Tổng quan)
├── 01-architecture.md              ← Kiến trúc tổng thể & luồng request
├── 02-identity-service.md          ← Đặc tả Identity Service
├── 03-meeting-service.md           ← Đặc tả Meeting Service (nghiệp vụ cốt lõi)
├── 04-chat-service.md              ← Đặc tả Chat Service
├── 05-media-service.md             ← Đặc tả Media Service
├── 06-api-gateway.md               ← Đặc tả API Gateway
├── 07-database-design.md           ← Schema chi tiết tất cả DB
├── 08-communication-patterns.md    ← Giao tiếp đồng bộ/bất đồng bộ, Saga Pattern
├── 09-websocket-design.md          ← Thiết kế WebSocket & Real-time
└── 10-api-reference.md             ← Bản đồ API Endpoint toàn hệ thống
```

---

## Công Nghệ Sử Dụng

| Hạng mục | Công nghệ |
|---|---|
| Framework | Spring Boot 3.x |
| API Gateway | Spring Cloud Gateway |
| Xác thực | JWT (HS256 — Shared Secret Key dùng chung) |
| Sync Communication (Inter-service) | **gRPC** |
| Async Communication | Apache Kafka |
| Reliability Pattern | Transactional Outbox Pattern |
| Media/Video | LiveKit (SFU WebRTC) + Egress API |
| Storage | **AWS S3** |
| Cache / Token Store | **Redis** |
| DB Identity/Meeting/Media | MySQL |
| DB Chat | MongoDB |
| Real-time (Chat) | WebSocket + STOMP (SimpleBroker) |
| Containerization | Docker + Docker Compose |
| Service Discovery | **Spring Cloud Netflix Eureka** |

---

## Quy Tắc Viết Code Chung

1. **Không inject cross-service foreign key** vào database.
2. **Không gọi trực tiếp service khác từ repository layer** — chỉ gọi ở service/use-case layer.
3. Service con **không validate JWT** — chỉ đọc `X-User-Id` và `X-User-Email` từ Header.
4. Mọi response đều wrap trong cấu trúc `ApiResponse<T>` thống nhất.
5. Error code và message phải nhất quán giữa các service.
6. **Giao tiếp nội bộ** giữa service dùng **gRPC** — không dùng REST Feign cho inter-service call.
7. Validation phải được thực hiện ở tầng Controller (Bean Validation) và trả về lỗi chuẩn.

---

## Cấu Trúc Response Chung (`ApiResponse<T>`)

Mọi HTTP response đều bọc trong wrapper sau:

```json
{
  "code": 1000,
  "message": "Success",
  "data": { ... }
}
```

**Khi thành công**: `code = 1000`, `data` chứa kết quả.

**Khi lỗi nghiệp vụ**: `code` là mã lỗi tùy chỉnh (xem bảng mã lỗi), `data = null`:
```json
{
  "code": 4041,
  "message": "MEETING_NOT_FOUND",
  "data": null
}
```

**Khi validation fail** (HTTP 400): trả về danh sách lỗi field:
```json
{
  "code": 4000,
  "message": "VALIDATION_FAILED",
  "data": [
    { "field": "email", "message": "Email không hợp lệ" },
    { "field": "password", "message": "Mật khẩu phải có ít nhất 8 ký tự" }
  ]
}
```

---

## Bảng Mã Lỗi (Error Codes)

### Nhóm 1xxx — Thành Công
| Code | Ý nghĩa |
|---|---|
| `1000` | Success |

### Nhóm 4xxx — Lỗi Client
| Code | HTTP Status | Ý nghĩa |
|---|---|---|
| `4000` | 400 | Validation failed (lỗi dữ liệu đầu vào) |
| `4010` | 401 | Chưa xác thực (thiếu hoặc JWT không hợp lệ) |
| `4011` | 401 | JWT đã hết hạn |
| `4012` | 401 | Refresh token không hợp lệ hoặc đã hết hạn |
| `4030` | 403 | Không có quyền thực hiện hành động này |
| `4031` | 403 | Chỉ owner mới được thực hiện |
| `4032` | 403 | Chỉ host mới được thực hiện |
| `4041` | 404 | Meeting không tìm thấy |
| `4042` | 404 | User không tìm thấy |
| `4043` | 404 | Recording không tìm thấy |
| `4044` | 404 | Participant không tìm thấy |
| `4091` | 409 | Email đã tồn tại |
| `4092` | 409 | Đã gửi feedback cho cuộc họp này |
| `4093` | 409 | Cuộc họp đã kết thúc hoặc bị hủy |

### Nhóm 4220 — Lỗi Nghiệp Vụ Meeting
| Code | HTTP Status | Ý nghĩa |
|---|---|---|
| `4220` | 422 | Meeting chưa tới giờ (attendee vào quá sớm) |
| `4221` | 422 | Sai mật khẩu phòng họp |
| `4222` | 422 | Email không nằm trong danh sách được phép (RESTRICTED/TRUSTED) |
| `4223` | 422 | Participant bị kick — không thể tự vào lại |
| `4224` | 422 | Phòng đã có recording đang chạy |

### Nhóm 5xxx — Lỗi Server
| Code | HTTP Status | Ý nghĩa |
|---|---|---|
| `5000` | 500 | Lỗi server nội bộ không xác định |
| `5001` | 503 | Service đích không khả dụng (gRPC/Kafka unavailable) |
| `5002` | 500 | Lỗi kết nối LiveKit |
| `5003` | 500 | Lỗi upload/lưu file (S3) |

---

## Xử Lý Lỗi Tập Trung (Global Exception Handling)

Mỗi service đều có một `GlobalExceptionHandler` (`@RestControllerAdvice`) xử lý tập trung:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Lỗi validation từ @Valid / @Validated
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<List<FieldError>>> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldError> errors = ex.getBindingResult().getFieldErrors()
            .stream()
            .map(e -> new FieldError(e.getField(), e.getDefaultMessage()))
            .toList();
        return ResponseEntity.badRequest()
            .body(ApiResponse.error(4000, "VALIDATION_FAILED", errors));
    }

    // Lỗi nghiệp vụ tùy chỉnh
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        ErrorCode code = ex.getErrorCode();
        return ResponseEntity.status(code.getHttpStatus())
            .body(ApiResponse.error(code.getCode(), code.getMessage()));
    }

    // Lỗi không xác định
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.internalServerError()
            .body(ApiResponse.error(5000, "INTERNAL_SERVER_ERROR"));
    }
}
```

**Enum `ErrorCode`** (ví dụ):
```java
public enum ErrorCode {
    SUCCESS(1000, "Success", HttpStatus.OK),
    VALIDATION_FAILED(4000, "VALIDATION_FAILED", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(4010, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED),
    JWT_EXPIRED(4011, "JWT_EXPIRED", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(4030, "FORBIDDEN", HttpStatus.FORBIDDEN),
    MEETING_NOT_FOUND(4041, "MEETING_NOT_FOUND", HttpStatus.NOT_FOUND),
    EMAIL_ALREADY_EXISTS(4091, "EMAIL_ALREADY_EXISTS", HttpStatus.CONFLICT),
    // ...
    ;

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;
}
```

---

## Service Discovery — Spring Cloud Eureka

### Kiến trúc

```
Eureka Server (Port: 8761)
    │
    ├── API Gateway (đăng ký dưới tên: api-gateway)
    ├── Identity Service (đăng ký dưới tên: identity-service)
    ├── Meeting Service (đăng ký dưới tên: meeting-service)
    ├── Chat Service (đăng ký dưới tên: chat-service)
    └── Media Service (đăng ký dưới tên: media-service)
```

### Cấu hình mỗi service

```yaml
# application.yml của mỗi service
eureka:
  client:
    service-url:
      defaultZone: http://eureka-server:8761/eureka/
    register-with-eureka: true
    fetch-registry: true
  instance:
    prefer-ip-address: true
    lease-renewal-interval-in-seconds: 30
    lease-expiration-duration-in-seconds: 90

spring:
  application:
    name: identity-service  # tên unique của từng service
```

### Lợi ích
- API Gateway dùng tên service thay vì hard-coded URL: `lb://identity-service`
- gRPC client resolve địa chỉ server qua Eureka dynamically
- Health check tự động, loại bỏ instance unhealthy

### Cấu hình Eureka Server (riêng biệt)

```yaml
# eureka-server/application.yml
server:
  port: 8761

eureka:
  client:
    register-with-eureka: false  # Server không tự đăng ký
    fetch-registry: false
  server:
    enable-self-preservation: false  # Tắt trong môi trường dev
```
