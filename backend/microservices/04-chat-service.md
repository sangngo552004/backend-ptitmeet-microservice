# 04. Chat Service — Đặc Tả Chi Tiết

**Port**: 8083  
**Database**: MongoDB — `ptitmeet_chat_db`  
**Vai trò**: Quản lý toàn bộ luồng tin nhắn real-time và lịch sử chat trong phòng họp.

---

## 1. Trách Nhiệm

| Chức năng | Mô tả |
|---|---|
| Gửi tin nhắn real-time | Nhận message qua WebSocket/STOMP, persist vào MongoDB, broadcast |
| Lịch sử chat | Trả về danh sách messages theo `meeting_code` |
| Đếm tin nhắn | Cung cấp API đếm số messages của một phòng (cho Meeting Summary) |

---

## 2. Database Schema — `ptitmeet_chat_db` (MongoDB)

### Collection `meeting_chats`

| Field | Kiểu | Mô tả |
|---|---|---|
| `_id` | ObjectId | Auto-generated bởi MongoDB |
| `meeting_code` | String | Mã phòng họp (liên kết lỏng với Meeting DB) |
| `sender_id` | String (UUID thô) | UUID của người gửi |
| `sender_name` | String | Tên hiển thị của người gửi tại thời điểm gửi |
| `content` | String | Nội dung tin nhắn |
| `timestamp` | ISODate | Thời điểm gửi tin |

**Index khuyến nghị**:
- `{ meeting_code: 1, timestamp: 1 }` — Query lịch sử chat theo phòng, sắp xếp theo thời gian.

---

## 3. Cơ Chế WebSocket

### Chiến lược giai đoạn học tập (Single Instance)

- Chat Service chạy **duy nhất 1 instance**.
- Dùng **In-Memory SimpleBroker** của Spring WebSocket.
- Toàn bộ WebSocket session tập trung ở RAM của instance duy nhất này.
- Không cần Redis Pub/Sub hay message broker ngoài.

> **Lý do**: Đơn giản hóa triển khai. Khi scale sau này sẽ thêm Redis Pub/Sub hoặc chuyển sang full Kafka.

### Cấu hình STOMP

```
WebSocket Endpoint:  ws://<api-gateway>:8080/ws
STOMP Destinations:
  - Gửi message:       /app/chat/{meetingCode}
  - Subscribe chat:    /topic/chat/{meetingCode}
  - Subscribe system:  /topic/meeting/{meetingCode}    (host controls từ Meeting Service)
  - Subscribe private: /queue/user/{userId}            (approval response)
```

### Luồng Gửi Tin Nhắn

```
Client → STOMP /app/chat/{meetingCode}
           │
           ├── Đọc sender_id từ header (injected bởi Gateway)
           ├── Tạo ChatMessage entity
           ├── Lưu vào MongoDB
           └── Broadcast đến /topic/chat/{meetingCode}
                   │
                   └── Tất cả client trong phòng nhận được
```

---

## 4. API Endpoints (REST)

**Base path**: `/api/chat`  
*(Internal — chủ yếu được Meeting Service gọi)*

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/chat/{meetingCode}/history` | ✅ (X-User-Id) | Lấy lịch sử chat của phòng |
| `GET` | `/api/chat/{meetingCode}/count` | Internal | Đếm số messages (cho Meeting Summary) |

### `GET /api/chat/{meetingCode}/history`

**Response**:
```json
{
  "code": 200,
  "message": "Success",
  "data": [
    {
      "id": "mongo-object-id",
      "meetingCode": "abc-defg-hij",
      "senderId": "uuid",
      "senderName": "Nguyễn Văn A",
      "content": "Chào mọi người!",
      "timestamp": "2026-06-16T10:30:00Z"
    }
  ]
}
```

**Business rules**:
- Chỉ owner hoặc participant đang active trong phòng mới được xem.
- Chat Service cần gọi Meeting Service để verify quyền truy cập (hoặc Meeting Service là người gọi trực tiếp).

---

## 5. WebSocket Message Format

### Chat Message (Client → Server)
```json
{
  "content": "Chào mọi người!"
}
```
*(senderId và senderName được lấy từ Header `X-User-Id` và context)*

### Chat Message Broadcast (Server → Client)
```json
{
  "id": "mongo-object-id",
  "meetingCode": "abc-defg-hij",
  "senderId": "uuid",
  "senderName": "Nguyễn Văn A",
  "content": "Chào mọi người!",
  "timestamp": "2026-06-16T10:30:00.000Z"
}
```

### System Event (Host Control — Meeting Service broadcast qua Chat Service broker)
```json
{
  "action": "MUTE_PARTICIPANT",
  "targetUserId": "uuid",
  "initiatorId": "host-uuid"
}
```

### Approval Response (Private Queue)
```json
{
  "action": "APPROVED",  // hoặc "REJECTED"
  "token": "livekit-token",
  "serverUrl": "wss://livekit-server",
  "role": "GUEST"
}
```

---

## 6. Gateway WebSocket Passthrough

- API Gateway cấu hình WebSocket proxy: Kết nối WebSocket từ client được passthrough toàn bộ tới Chat Service port 8083.
- Gateway **không break** WebSocket connection để inject header theo từng frame — thay vào đó, khi WebSocket upgrade request đến, Gateway đã inject `X-User-Id` vào upgrade HTTP header.
- Chat Service đọc `X-User-Id` từ WebSocket handshake headers.

---

## 7. Tích Hợp Với Các Service Khác

| Service | Cơ chế | Mục đích |
|---|---|---|
| Meeting Service | HTTP (được gọi bởi Meeting) | Meeting Service lấy chat history và message count |
| API Gateway | WebSocket Proxy | Client kết nối qua Gateway, passthrough tới Chat Service |
