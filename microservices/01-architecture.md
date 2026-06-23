# 01. Kiến Trúc Tổng Thể — PTITMeet Microservices

## 1. Sơ Đồ Kiến Trúc Tổng Quan

```
                          ┌─────────────────────────────────────────┐
                          │               FRONTEND                   │
                          │         React + LiveKit SDK              │
                          └────────────────┬────────────────────────┘
                                           │ HTTPS / WSS
                          ┌────────────────▼────────────────────────┐
                          │            API GATEWAY                   │
                          │          Spring Cloud Gateway            │
                          │              Port: 8080                  │
                          │                                          │
                          │  1. Xác thực JWT (verify signature)     │
                          │  2. Inject X-User-Id, X-User-Email      │
                          │  3. Route đến service đích               │
                          │  4. WebSocket passthrough (Chat)         │
                          └─────┬────────┬──────────┬───────────────┘
                                │        │          │
               ┌────────────────▼──┐  ┌──▼───────────▼──────────────────┐
               │  Identity Service │  │  Meeting Service  Chat  Media    │
               │    Port: 8081     │  │  8082             8083   8084    │
               │  MySQL (identity) │  │  MySQL(meeting) Mongo  MySQL     │
               └───────────────────┘  └─────────────────────────────────┘
                                                   │
                                    ┌──────────────▼───────────────┐
                                    │          Apache Kafka         │
                                    │   (Async Event Bus)           │
                                    └───────────────────────────────┘
                                                   │
                                    ┌──────────────▼───────────────┐
                                    │      Notification Service     │
                                    │   (Email, Push — tương lai)   │
                                    └───────────────────────────────┘
```

---

## 2. Luồng Request Tiêu Chuẩn (Happy Path)

```
Client  →  API Gateway  →  [Verify JWT]  →  Inject Headers  →  Service Con  →  Response
```

**Chi tiết**:

1. Client gửi request với `Authorization: Bearer <access_token>`.
2. Gateway giải mã và verify chữ ký JWT bằng **Shared Secret Key**.
3. Nếu hợp lệ, Gateway **inject** vào request:
   - `X-User-Id: <userId-UUID>`
   - `X-User-Email: <email>`
4. Gateway forward request tới service tương ứng theo routing rule.
5. Service con đọc `X-User-Id` từ header để biết người dùng hiện tại — **KHÔNG validate lại JWT**.
6. Service con xử lý nghiệp vụ và trả về response.

**Endpoint không cần xác thực** (Gateway cho đi thẳng):
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/livekit/webhook` (LiveKit callback — kiểm tra bằng webhook secret riêng)

---

## 3. Routing Map của API Gateway

| Prefix URL Pattern | Forward đến Service | Port đích |
|---|---|---|
| `/api/auth/**` | Identity Service | 8081 |
| `/api/users/**` | Identity Service | 8081 |
| `/api/meetings/**` | Meeting Service | 8082 |
| `/api/livekit/webhook` | Media Service | 8084 |
| `/api/livekit/recordings/**` | Media Service | 8084 |
| `/ws/**` | Chat Service (WebSocket) | 8083 |

---

## 4. Vai Trò Người Dùng Trong Phòng Họp

Hệ thống phân tách rõ ràng 2 loại vai trò để tránh ambiguity trong nghiệp vụ:

### `ownerId` (Chủ phòng gốc — bất biến)
- Là người **tạo ra cuộc họp**.
- **Không thay đổi** trong suốt vòng đời cuộc họp, kể cả khi transfer host.
- Quyền đặc biệt:
  - Bắt đầu / dừng recording.
  - Xem toàn bộ danh sách recordings.
  - Xem đầy đủ lịch sử chat.
  - Ưu tiên quyền sở hữu dữ liệu cuộc họp.

### `hostId` (Host runtime — có thể thay đổi)
- Là người **điều phối phiên họp tại thời điểm hiện tại**.
- Có thể thay đổi khi host rời phòng (auto-transfer sang participant active tiếp theo).
- Quyền runtime:
  - Approve/Reject waiting room.
  - Mute / Stop Camera / Kick participant.
  - Mute All.
  - End meeting for all.

**Ví dụ nghiệp vụ**: Người A tạo phòng → `ownerId = A, hostId = A`. A transfer host cho B → `ownerId = A, hostId = B`. A quay lại vẫn là owner, nhưng không tự động lấy lại host.

---

## 5. Trạng Thái Meeting

```
SCHEDULED ──(host join)──► ACTIVE ──(all left / end)──► FINISHED
     │                                                       ▲
     └────────────────(cancel)──────────────────────► CANCELED
```

| Trạng thái | Ý nghĩa |
|---|---|
| `SCHEDULED` | Cuộc họp đã lên lịch, chưa bắt đầu |
| `ACTIVE` | Đang diễn ra |
| `FINISHED` | Kết thúc (tự động khi hết người, hoặc host end for all) |
| `CANCELED` | Bị hủy bởi owner trước khi diễn ra |

---

## 6. Access Type — Loại Quyền Truy Cập Phòng Họp

Field `access_type` trong bảng `meetings` quy định chính sách ai được tham gia cuộc họp.

| Access Type | Ý nghĩa | Ai được vào |
|---|---|---|
| `OPEN` | Phòng mở | Bất kỳ ai có link/mã phòng đều vào được (vẫn qua waiting room nếu bật) |
| `TRUSTED` | Phòng tin cậy | Chỉ user có email thuộc domain được chỉ định (field `allowed_domain`) |
| `RESTRICTED` | Phòng hạn chế | Chỉ user có email nằm trong danh sách `meeting_invitations` |

### Logic Kiểm Tra Access Type Trong Flow Join

```
User gửi join request
      │
      ├── [OPEN]       → Tiếp tục (không cần kiểm tra thêm)
      │
      ├── [TRUSTED]    → Lấy email từ X-User-Email header
      │                   Kiểm tra: email.endsWith("@" + meeting.allowedDomain)
      │                   Nếu không khớp → lỗi 4222 ACCESS_DENIED
      │
      └── [RESTRICTED] → Lấy email từ X-User-Email header
                          Kiểm tra: email có trong bảng meeting_invitations không
                          Nếu không có → lỗi 4222 ACCESS_DENIED
```

### Kết Hợp Với Waiting Room

Access Type và Waiting Room là **2 cơ chế độc lập**:
- `OPEN` + Waiting Room ON: Tất cả được request vào nhưng phải qua hàng chờ host duyệt.
- `RESTRICTED` + Waiting Room OFF: Chỉ người được mời vào thẳng, không qua waiting room.
- `RESTRICTED` + Waiting Room ON: Chỉ người được mời mới được gửi request, và vẫn phải qua waiting room.

---

## 6. Trạng Thái Approval Participant (Waiting Room)

| Trạng thái | Ý nghĩa |
|---|---|
| `PENDING` | Đang chờ host duyệt trong waiting room |
| `APPROVED` | Được vào phòng |
| `REJECTED` | Bị từ chối, phải xin lại |

---

## 7. Trạng Thái Participant Session

| Trạng thái | Ý nghĩa |
|---|---|
| `ACTIVE` | Đang trong phòng họp |
| `LEFT` | Đã rời phòng tự nguyện |
| `KICKED` | Bị host kick (lần vào tiếp theo phải qua waiting room lại) |
| `ENDED_BY_HOST` | Bị kết thúc bởi lệnh "End for all" của host |

---

## 8. Cấu Trúc Response Chuẩn

Tất cả API đều trả về cấu trúc sau:

```json
{
  "code": 200,
  "message": "Success",
  "data": { ... }
}
```

Khi lỗi:

```json
{
  "code": 4001,
  "message": "MEETING_NOT_FOUND",
  "data": null
}
```

---

## 9. Các Kênh Giao Tiếp Trong Hệ Thống

| Kênh | Công nghệ | Dùng cho |
|---|---|---|
| REST API | HTTP/HTTPS | Tạo meeting, join, leave, history, summary |
| WebSocket/STOMP | STOMP over WebSocket | Chat real-time, host controls, waiting room notification |
| LiveKit Media | WebRTC/SFU | Audio, Video, Screen share |
| Kafka | Apache Kafka | Gửi mail thông báo lịch họp (async, fire-and-forget) |
| gRPC | Protocol Buffers | Service-to-service call khi cần kết quả đồng bộ |
