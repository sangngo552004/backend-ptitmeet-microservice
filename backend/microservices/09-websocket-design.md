# 09. WebSocket Design — Real-time Communication

## Tổng Quan

Hệ thống sử dụng WebSocket với protocol STOMP (Simple Text Oriented Messaging Protocol) cho mọi giao tiếp real-time.

---

## 1. Kiến Trúc WebSocket (Giai Đoạn Học Tập)

```
Frontend (React)
    │
    │ ws:// (STOMP over WebSocket)
    │
    ▼
API Gateway (port 8080)
    │
    │ WebSocket Proxy (passthrough)
    │
    ▼
Chat Service (port 8083) — Single Instance
    │
    └── In-Memory SimpleBroker
          ├── /topic/...    (broadcast tới nhiều subscriber)
          └── /queue/...    (private message tới 1 user)
```

**Lý do dùng Single Instance + SimpleBroker**:
- Đơn giản, không cần cấu hình Redis/RabbitMQ.
- Toàn bộ WebSocket session tập trung tại RAM của instance này.
- Khi scale sang multi-instance sau này: thay bằng Redis Pub/Sub hoặc STOMP broker relay.

---

## 2. STOMP Endpoint Configuration

```java
// Chat Service — WebSocketConfig.java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker cho topic (broadcast) và queue (private)
        registry.enableSimpleBroker("/topic", "/queue");
        
        // Prefix cho messages từ client gửi lên server
        registry.setApplicationDestinationPrefixes("/app");
        
        // Prefix cho private queue (user-specific)
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns("*")
            .withSockJS();  // SockJS fallback cho browser không support native WS
    }
}
```

---

## 3. STOMP Destinations Map

### Subscribe (Client lắng nghe)

| Destination | Mô tả | Ai subscribe |
|---|---|---|
| `/topic/chat/{meetingCode}` | Broadcast tin nhắn chat của phòng | Tất cả participant trong phòng |
| `/topic/meeting/{meetingCode}` | System events (host controls, recording, host transfer) | Tất cả participant trong phòng |
| `/topic/meeting/{meetingCode}/host` | Notifications riêng cho host (waiting room requests) | Chỉ host |
| `/user/queue/approval` | Kết quả approve/reject từ host | Client đang ở waiting room |

### Publish (Client gửi lên)

| Destination | Handler | Mô tả |
|---|---|---|
| `/app/chat/{meetingCode}` | `ChatController` | Gửi tin nhắn chat |
| `/app/meeting/{meetingCode}/system` | `MeetingSystemController` | Host actions (mute, kick, end...) |

---

## 4. Message Flow Chi Tiết

### 4.1 Chat Message Flow

```
Client A gửi: SEND /app/chat/abc-defg-hij
    Body: { "content": "Chào mọi người!" }
    Headers: X-User-Id: uuid (injected từ STOMP handshake)

Chat Service — ChatController:
    1. Đọc sender_id từ header
    2. Tạo ChatMessage { meetingCode, sender_id, sender_name, content, timestamp }
    3. Lưu vào MongoDB
    4. Broadcast: messagingTemplate.convertAndSend(
           "/topic/chat/abc-defg-hij",
           chatMessageResponse
       )

Tất cả client đang subscribe /topic/chat/abc-defg-hij nhận:
    {
      "id": "mongo-id",
      "meetingCode": "abc-defg-hij",
      "senderId": "uuid",
      "senderName": "Nguyễn Văn A",
      "content": "Chào mọi người!",
      "timestamp": "2026-06-16T10:30:00Z"
    }
```

### 4.2 Waiting Room Notification Flow

```
Guest join meeting → approval_status = PENDING

Meeting Service:
    → messagingTemplate.convertAndSend(
          "/topic/meeting/{code}/host",
          { action: "JOIN_REQUEST", participant: { userId, displayName, ... } }
      )

Host (đang subscribe /topic/meeting/{code}/host) nhận thông báo:
    → Hiển thị toast "Nguyễn Văn B xin vào phòng"
    → Host bấm Approve/Reject

Meeting Service xử lý approval:
    → Cập nhật participant.approval_status
    → Tạo ParticipantSession (nếu APPROVED)
    → Gọi LiveKit generateJoinToken (nếu APPROVED)
    → messagingTemplate.convertAndSendToUser(
          guestUserId,
          "/queue/approval",
          {
            action: "APPROVED",
            token: "livekit-token",
            serverUrl: "wss://...",
            role: "GUEST"
          }
      )

Guest nhận response → tự động redirect vào phòng họp
```

### 4.3 Host Controls Flow

```
Host gửi: SEND /app/meeting/abc-defg-hij/system
    Body: { "action": "KICK_PARTICIPANT", "targetUserId": "uuid" }

Meeting Service — MeetingSystemController:
    1. Verify sender là host (X-User-Id == meeting.hostId)
    2. Thực thi action: set session = KICKED
    3. Broadcast đến tất cả trong phòng:
       messagingTemplate.convertAndSend(
           "/topic/meeting/abc-defg-hij",
           { action: "KICK_PARTICIPANT", targetUserId: "uuid" }
       )

Frontend của participant bị kick:
    → Nhận message
    → Ngắt kết nối LiveKit Room
    → Redirect tới /summary với actionTaken="KICKED"
```

### 4.4 Recording Event Flow

```
Owner bấm Start Recording:
    → Call REST API: POST /api/livekit/recordings/start?meetingCode=abc-defg-hij
    → Meeting Service gọi Media Service (Feign)
    → Media Service gọi LiveKit Egress API
    → Nhận egressId

Meeting Service broadcast:
    messagingTemplate.convertAndSend(
        "/topic/meeting/abc-defg-hij",
        { action: "RECORDING_STARTED", egressId: "egress-123" }
    )

Tất cả participant nhận → hiển thị indicator REC đang nhấp nháy
```

### 4.5 Host Transfer Flow

```
Host rời phòng: POST /api/meetings/{code}/leave

Meeting Service leaveMeeting():
    1. Set session = LEFT
    2. Phòng còn người active?  YES
    3. Người vừa rời là hostId?  YES
    4. Transfer: meeting.hostId = nextActiveParticipant.userId
    5. Broadcast:
       messagingTemplate.convertAndSend(
           "/topic/meeting/abc-defg-hij",
           {
             action: "HOST_TRANSFERRED",
             newHostId: "new-host-uuid",
             newHostName: "Trần Văn B"
           }
       )

Tất cả participant nhận → cập nhật UI hiển thị host mới
New host nhận → unlock các control của host
```

---

## 5. WebSocket Authentication (Handshake)

Khi client kết nối WebSocket tới Gateway:

```
1. Client gửi HTTP Upgrade request tới:
   ws://gateway:8080/ws?token=<access-token>
   (hoặc Authorization header)

2. API Gateway:
   - Intercept upgrade request
   - Verify JWT token
   - Inject X-User-Id vào upgrade request headers
   - Proxy WebSocket connection tới chat-service:8083

3. Chat Service WebSocket Handshake Interceptor:
   - Đọc X-User-Id từ upgrade headers
   - Lưu vào WebSocket session attributes
   - STOMP handler đọc từ session attributes cho mỗi frame
```

---

## 6. Scalability Roadmap

| Giai đoạn | Cấu hình | Giới hạn |
|---|---|---|
| **Hiện tại (Học tập)** | Single instance + SimpleBroker | Phụ thuộc RAM của 1 server |
| **Phase 2 (Scale)** | Multi-instance + Redis Pub/Sub | Scale horizontal, nhưng cần thêm Redis |
| **Phase 3 (Enterprise)** | External STOMP Broker (ActiveMQ/RabbitMQ) | Full scale, durable subscriptions |

---

## 7. Đặc Điểm Kỹ Thuật

| Tham số | Giá trị |
|---|---|
| Protocol | WebSocket + STOMP |
| Broker type | In-Memory SimpleBroker (Spring) |
| Prefix gửi | `/app/...` |
| Prefix nhận broadcast | `/topic/...` |
| Prefix nhận private | `/queue/...` |
| SockJS fallback | Có (cho browser cũ) |
| Heartbeat | Spring STOMP mặc định (10s outbound, 0 inbound) |
| Max sessions | Phụ thuộc RAM và thread pool của JVM |
