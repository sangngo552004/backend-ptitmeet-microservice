# 08. Communication Patterns — Giao Tiếp Giữa Các Service

## Tổng Quan

Hệ thống sử dụng 2 chiến lược giao tiếp chính:

| Chiến lược | Công nghệ | Khi nào dùng |
|---|---|---|
| **Đồng bộ (Sync)** | REST (OpenFeign) hoặc gRPC | Cần kết quả ngay, hiển thị trực tiếp lên UI |
| **Bất đồng bộ (Async)** | Apache Kafka | Tác vụ nền, không cần kết quả tức thì |

---

## 1. Giao Tiếp Đồng Bộ (Sync — REST/gRPC)

### Khi nào dùng?
- Người dùng click "Start Recording" → Meeting Service cần kết quả ngay từ Media Service.
- Meeting Info cần hiển thị `host_name` → Meeting Service hỏi Identity Service.
- Summary cần đếm messages → Meeting Service hỏi Chat Service.

### Cơ chế xử lý lỗi (Compensating Transaction)

**Tình huống**: Meeting Service gọi Media Service để start recording. Media Service thành công. Nhưng sau đó Meeting Service gặp lỗi (DB fail, exception, ...).

```
Meeting Service
    │
    ├── Step 1: Gọi Media Service → Start recording (THÀNH CÔNG)
    │              egressId = "egress-123"
    │
    ├── Step 2: Lưu vào Meeting DB → LỖI (exception)
    │
    └── Step 3: Catch lỗi:
              ├── Rollback local DB transaction (tự động)
              └── Compensating Call → DELETE /api/media/recordings/egress-123
                        Media Service: stopEgress + xóa bản ghi
```

**Tình huống ngược lại**: Media Service fail → Media Service tự throw Exception → Meeting Service catch ở Feign call → Rollback local → Trả lỗi về Frontend. Không cần compensating vì Media Service chưa làm gì cả.

### Cấu Hình Feign Client (Ví dụ)

```java
// Meeting Service → Media Service
@FeignClient(name = "media-service", url = "${services.media}")
public interface MediaServiceClient {
    
    @PostMapping("/api/livekit/recordings/start")
    ApiResponse<MeetingRecording> startRecording(
        @RequestParam("meetingCode") String meetingCode,
        @RequestHeader("X-User-Id") String userId
    );
    
    @PostMapping("/api/livekit/recordings/stop")
    ApiResponse<Void> stopRecording(
        @RequestParam("egressId") String egressId
    );
    
    @DeleteMapping("/api/livekit/recordings/{egressId}")
    ApiResponse<Void> compensateRecording(
        @PathVariable("egressId") String egressId
    );
}
```

```java
// Meeting Service → Identity Service (internal)
@FeignClient(name = "identity-service-internal", url = "${services.identity}")
public interface IdentityServiceClient {
    
    @GetMapping("/internal/users/{userId}")
    ApiResponse<UserInfo> getUserById(@PathVariable("userId") String userId);
    
    @PostMapping("/internal/users/batch")
    ApiResponse<List<UserInfo>> getUsersByIds(@RequestBody List<String> userIds);
}
```

```java
// Meeting Service → Chat Service
@FeignClient(name = "chat-service", url = "${services.chat}")
public interface ChatServiceClient {
    
    @GetMapping("/api/chat/{meetingCode}/history")
    ApiResponse<List<ChatMessage>> getChatHistory(
        @PathVariable("meetingCode") String meetingCode
    );
    
    @GetMapping("/api/chat/{meetingCode}/count")
    ApiResponse<Integer> getMessageCount(
        @PathVariable("meetingCode") String meetingCode
    );
}
```

### Timeout & Circuit Breaker (Khuyến nghị)

```yaml
feign:
  client:
    config:
      default:
        connectTimeout: 5000    # 5 giây
        readTimeout: 10000      # 10 giây

resilience4j:
  circuitbreaker:
    instances:
      media-service:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
```

---

## 2. Giao Tiếp Bất Đồng Bộ (Async — Apache Kafka)

### Khi nào dùng?
- Schedule meeting → Gửi email mời họp cho participants (tốn thời gian, không cần kết quả ngay).
- Các tác vụ notification khác (reminder trước khi họp, v.v.).

### Transactional Outbox Pattern

**Vấn đề**: Nếu ghi vào DB thành công nhưng publish Kafka fail → mất event → email không được gửi.  
**Giải pháp**: Outbox Pattern — ghi event vào DB trong cùng 1 transaction với dữ liệu nghiệp vụ.

```
Meeting Service — scheduleMeeting()
    │
    ├── BEGIN TRANSACTION
    │     ├── INSERT meetings (meeting_id, title, ...)
    │     ├── INSERT meeting_invitations (emails)
    │     └── INSERT outbox_events (event_type='MEETING_SCHEDULED', payload={...})
    └── COMMIT  ← Nếu thành công, event CHẮC CHẮN được ghi vào DB

Outbox Worker (chạy ngầm — Polling hoặc CDC)
    │
    ├── SELECT * FROM outbox_events WHERE status='PENDING'
    │
    ├── FOR EACH event:
    │     ├── Publish đến Kafka topic: "meeting-events"
    │     └── UPDATE outbox_events SET status='SENT', processed_at=now()
    │
    └── Nếu Kafka fail: giữ nguyên status='PENDING', retry sau
```

### Kafka Topics

| Topic | Producer | Consumer | Event Types |
|---|---|---|---|
| `meeting-events` | Meeting Service | Notification Service | `MEETING_SCHEDULED`, `MEETING_CANCELED`, `INVITATION_SENT` |
| `media-events` | Media Service | (tương lai) | `RECORDING_COMPLETED` |

### Event Payload Schema

```json
// Topic: meeting-events
// Event: MEETING_SCHEDULED
{
  "eventType": "MEETING_SCHEDULED",
  "aggregateId": "meeting-uuid",
  "timestamp": "2026-06-16T10:00:00Z",
  "payload": {
    "meetingId": "uuid",
    "title": "Họp nhóm tuần 20",
    "meetingCode": "abc-defg-hij",
    "startTime": "2026-06-20T09:00:00Z",
    "endTime": "2026-06-20T10:00:00Z",
    "hostName": "Nguyễn Văn A",
    "invitedEmails": ["user1@gmail.com", "user2@gmail.com"]
  }
}
```

---

## 3. Distributed Transaction Strategy

### Saga Pattern (Choreography-based)

Trong giai đoạm hiện tại, áp dụng **choreography saga** đơn giản:

```
Luồng Start Recording (Sync Saga — 2 bước):

Step 1: Media Service → startRoomCompositeEgress (LiveKit)
         → Thành công: lưu recording với status=RECORDING
         → Thất bại: throw exception lên caller

Step 2: Meeting Service nhận egressId
         → Thành công: broadcast RECORDING_STARTED
         → Thất bại (DB fail): compensate → xóa recording ở Media Service

Kết quả: Consistent hoặc đã compensate
```

### Idempotency

Các API có thể được gọi lại (retry) phải idempotent:

| API | Cơ chế Idempotency |
|---|---|
| Start Recording | Check `egress_id` đã tồn tại chưa trước khi gọi LiveKit |
| Submit Feedback | UNIQUE constraint `(meeting_id, user_id)` |
| Approve Participant | Idempotent — set status, không tạo duplicate |

---

## 4. Internal Service Network

Trong môi trường Docker Compose, các service giao tiếp qua Docker internal network:

```yaml
# docker-compose.yml (excerpt)
services:
  api-gateway:
    environment:
      - IDENTITY_SERVICE_URL=http://identity-service:8081
      - MEETING_SERVICE_URL=http://meeting-service:8082
      - CHAT_SERVICE_URL=http://chat-service:8083
      - MEDIA_SERVICE_URL=http://media-service:8084

  meeting-service:
    environment:
      - IDENTITY_SERVICE_URL=http://identity-service:8081
      - CHAT_SERVICE_URL=http://chat-service:8083
      - MEDIA_SERVICE_URL=http://media-service:8084
      - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
```

> **Bảo mật nội bộ**: Các endpoint `/internal/**` chỉ accessible trong Docker network, không expose qua Gateway.

---

## 5. Ma Trận Giao Tiếp Service

| Caller → Callee | Identity | Meeting | Chat | Media | Kafka |
|---|---|---|---|---|---|
| **API Gateway** | Route | Route | Route (WS) | Route | — |
| **Meeting Service** | Feign (get user info) | — | Feign (chat history) | Feign (recording) | Publish |
| **Media Service** | — | Feign (verify owner) | — | — | — |
| **Chat Service** | — | — | — | — | — |
| **Identity Service** | — | — | — | — | — |
