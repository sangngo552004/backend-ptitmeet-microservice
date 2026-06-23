# 03. Meeting Service — Đặc Tả Chi Tiết

**Port**: 8082  
**Database**: MySQL — `ptitmeet_meeting_db`  
**Vai trò**: Trái tim nghiệp vụ của hệ thống. Quản lý toàn bộ vòng đời cuộc họp, thành viên, phòng chờ, và lịch sử.

---

## 1. Trách Nhiệm

| Chức năng | Mô tả |
|---|---|
| Tạo phòng tức thì | Tạo và kích hoạt meeting ngay lập tức |
| Lên lịch họp | Tạo meeting có `startTime`, `endTime`, mời qua email |
| Tham gia phòng (Join) | Flow nghiệp vụ phức tạp nhất: kiểm tra quyền, waiting room, cấp LiveKit token |
| Phòng chờ (Waiting Room) | Host duyệt / từ chối người xin vào |
| Host controls | Mute, Kick, Transfer host, End meeting for all |
| Rời phòng (Leave) | Cập nhật session, auto-finish nếu hết người, auto-transfer host |
| Lịch sử họp | Truy vấn lịch sử có phân trang, filter theo role/status |
| Tóm tắt (Summary) | Thống kê thời gian, số người, số tin nhắn sau họp |
| Cài đặt phòng | Đọc / cập nhật meeting settings (JSON) |
| Phản hồi (Feedback) | Thu thập đánh giá sao sau họp |
| Hủy lịch | Chuyển trạng thái meeting sang `CANCELED` |

---

## 2. Database Schema — `ptitmeet_meeting_db`

### Bảng `meetings`

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `meeting_id` | UUID | PK | Định danh cuộc họp |
| `host_id` | UUID | NOT NULL | UUID thô — Host runtime hiện tại |
| `owner_id` | UUID | NOT NULL | UUID thô — Chủ phòng gốc (bất biến) |
| `meeting_code` | VARCHAR(20) | UNIQUE, NOT NULL | Mã phòng (VD: `abc-defg-hij`) |
| `title` | VARCHAR(255) | NULLABLE | Tiêu đề cuộc họp |
| `password` | VARCHAR(255) | NULLABLE | Mật khẩu phòng (hash hoặc plain tùy thiết kế) |
| `is_instant` | BOOLEAN | NOT NULL | `true` = phòng tức thì |
| `start_time` | TIMESTAMP | NULLABLE | Thời gian bắt đầu (NULL nếu instant) |
| `end_time` | TIMESTAMP | NULLABLE | Thời gian kết thúc (set khi FINISHED) |
| `access_type` | ENUM | NOT NULL | `OPEN`, `TRUSTED`, `RESTRICTED` |
| `allowed_domain` | VARCHAR(255) | NULLABLE | Domain được phép (cho `TRUSTED`) |
| `status` | ENUM | NOT NULL | `SCHEDULED`, `ACTIVE`, `FINISHED`, `CANCELED` |
| `settings` | JSON / TEXT | NULLABLE | JSON cấu hình phòng |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo |

**Meeting Settings JSON** (ví dụ):
```json
{
  "waitingRoom": true,
  "muteOnEntry": false,
  "cameraOffOnEntry": false,
  "allowChat": true,
  "allowScreenShare": true
}
```

### Bảng `participants`

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `participant_id` | UUID | PK | Định danh participant |
| `meeting_id` | UUID | FK → `meetings.meeting_id` | FK nội bộ trong meeting DB |
| `user_id` | UUID | NOT NULL | UUID thô — không FK sang identity DB |
| `display_name` | VARCHAR(255) | NOT NULL | Tên hiển thị trong phòng họp |
| `role` | ENUM | NOT NULL | `HOST`, `GUEST` |
| `approval_status` | ENUM | NOT NULL | `PENDING`, `APPROVED`, `REJECTED` |
| `created_at` | TIMESTAMP | NOT NULL | Lần đầu tham gia cuộc họp này |

> **Lưu ý**: Nếu user join lại phòng đã từng vào, hệ thống **reuse** bản ghi participant này thay vì tạo mới.

### Bảng `participant_sessions`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID / BIGINT | PK |
| `participant_id` | UUID | FK → `participants.participant_id` |
| `joined_at` | TIMESTAMP | Thời điểm vào phòng |
| `left_at` | TIMESTAMP | Thời điểm rời phòng (NULL nếu còn trong phòng) |
| `status` | ENUM | `ACTIVE`, `LEFT`, `KICKED`, `ENDED_BY_HOST` |
| `device_info` | TEXT | Thông tin thiết bị (user-agent) |
| `ip_address` | VARCHAR(50) | IP client |

> Mỗi lần join tạo một session mới. Dùng để tính thời gian tham gia, audit.

### Bảng `meeting_invitations`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID / BIGINT | PK |
| `meeting_id` | UUID | FK nội bộ |
| `email` | VARCHAR(255) | Email được mời |
| `user_id` | UUID | NULLABLE — UUID thô nếu người dùng đã có tài khoản |
| `created_at` | TIMESTAMP | Thời điểm gửi lời mời |

> Dùng để xác định ai thuộc danh sách "invited" khi kiểm tra quyền truy cập `RESTRICTED` meeting.

### Bảng `meeting_feedbacks`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID / BIGINT | PK |
| `meeting_id` | UUID | FK nội bộ |
| `user_id` | UUID | UUID thô — người đánh giá |
| `rating` | INT | 1–5 sao |
| `created_at` | TIMESTAMP | Thời điểm gửi feedback |

> Constraint: Mỗi user chỉ gửi 1 feedback cho 1 meeting (`UNIQUE(meeting_id, user_id)`).

### Bảng `outbox_events` (Transactional Outbox Pattern)

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGINT | PK AUTO_INCREMENT |
| `aggregate_type` | VARCHAR(50) | `MEETING` |
| `aggregate_id` | UUID | `meeting_id` liên quan |
| `event_type` | VARCHAR(100) | VD: `MEETING_SCHEDULED`, `INVITATION_SENT` |
| `payload` | JSON | Nội dung event (email, tên, thời gian, ...) |
| `status` | ENUM | `PENDING`, `SENT`, `FAILED` |
| `created_at` | TIMESTAMP | Thời điểm tạo event |
| `processed_at` | TIMESTAMP | Thời điểm event được xử lý |

---

## 3. Access Type & Waiting Room Logic

Khi user join meeting, hệ thống kiểm tra theo thứ tự:

```
1. Meeting có tồn tại không? → MEETING_NOT_FOUND
2. Meeting status có cho phép join không? (ACTIVE hoặc SCHEDULED)
3. User có phải owner/host không?
   - Nếu SCHEDULED + owner/host → kích hoạt meeting thành ACTIVE
   - Nếu SCHEDULED + attendee vào sớm → trả về PENDING, thông báo "chờ host"
4. Access type check:
   - OPEN: Tất cả được vào (trừ bị kick trước đó)
   - TRUSTED: Chỉ email trong domain được phép
   - RESTRICTED: Chỉ email trong danh sách invitation
5. Waiting room check:
   - Nếu settings.waitingRoom = true → PENDING → thông báo host
   - Host/Owner: luôn APPROVED
6. Password check (nếu meeting có password)
7. Kicked check: Nếu latestSession.status = KICKED → quay về waiting room
```

**Kết quả join**:
- `APPROVED`: Cấp LiveKit token, tạo session mới với status `ACTIVE`.
- `PENDING`: Lưu participant với status `PENDING`, gửi STOMP notification cho host, trả về waiting.

---

## 4. Join Meeting — Flow Chi Tiết

```
Client POST /api/meetings/{code}/join
        │
        ├── Tìm meeting theo code
        │     └── 404 if not found
        │
        ├── Check meeting status (ACTIVE hoặc SCHEDULED)
        │     └── 400 if FINISHED/CANCELED
        │
        ├── Xác định vai trò user
        │     ├── isOwner = (userId == meeting.ownerId)
        │     └── isRuntimeHost = (userId == meeting.hostId)
        │
        ├── Xử lý SCHEDULED meeting
        │     ├── Host/Owner → set ACTIVE
        │     └── Guest → return PENDING "chờ host"
        │
        ├── Validate access type (OPEN/TRUSTED/RESTRICTED)
        │
        ├── Tìm hoặc tạo Participant record
        │     └── Save trước khi tạo Session (tránh TransientObjectException)
        │
        ├── Kiểm tra lịch sử session
        │     └── Nếu latestSession = KICKED → về waiting room
        │
        ├── Nếu PENDING (waiting room)
        │     ├── Tạo Participant với status PENDING
        │     ├── Gửi STOMP notification đến host: "/topic/meeting/{code}/host"
        │     └── Trả về response PENDING
        │
        └── Nếu APPROVED
              ├── Tạo ParticipantSession với status ACTIVE
              ├── Gọi liveKitService.generateJoinToken(roomName, userId, displayName)
              └── Trả về JoinMeetingResponse {
                    token, serverUrl, status, role,
                    settings, isOwner, currentHostId
                  }
```

---

## 5. Leave Meeting & Host Transfer Logic

```
Client POST /api/meetings/{code}/leave
        │
        ├── Tìm active session của user → set status LEFT, left_at = now
        │
        ├── Kiểm tra còn ai ACTIVE không?
        │     └── Không còn ai → set meeting.status = FINISHED, endTime = now
        │
        └── Nếu còn người & user vừa rời là hostId hiện tại:
              ├── Tìm participant ACTIVE tiếp theo (order by joined_at)
              ├── Set meeting.hostId = participant.userId
              └── Broadcast STOMP event HOST_TRANSFERRED tới "/topic/meeting/{code}"
```

---

## 6. Host Controls via WebSocket

**STOMP Endpoint**: `/app/meeting/{code}/system`  
**Topic nhận broadcast**: `/topic/meeting/{code}`

| Action | Payload | Mô tả |
|---|---|---|
| `MUTE_ALL` | `{}` | Tắt mic tất cả participant |
| `STOP_CAMERA_ALL` | `{}` | Tắt camera tất cả |
| `KICK_ALL` | `{}` | Đuổi tất cả (kết thúc meeting phía media) |
| `MUTE_PARTICIPANT` | `{targetUserId}` | Tắt mic một người |
| `STOP_CAMERA_PARTICIPANT` | `{targetUserId}` | Tắt camera một người |
| `KICK_PARTICIPANT` | `{targetUserId}` | Kick một người, set session = KICKED |
| `RECORDING_STARTED` | `{egressId}` | Thông báo bắt đầu ghi hình |
| `RECORDING_STOPPED` | `{egressId}` | Thông báo dừng ghi hình |
| `HOST_TRANSFERRED` | `{newHostId, newHostName}` | Thông báo chuyển host |

---

## 7. API Endpoints

**Base path**: `/api/meetings`

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/api/meetings/instant` | ✅ | Tạo phòng tức thì |
| `POST` | `/api/meetings/schedule` | ✅ | Lên lịch họp |
| `GET` | `/api/meetings/my-meetings` | ✅ | Danh sách meeting của tôi |
| `GET` | `/api/meetings/history` | ✅ | Lịch sử có phân trang (filter role, status) |
| `GET` | `/api/meetings/up-next` | ✅ | Meeting sắp tới gần nhất |
| `GET` | `/api/meetings/{code}` | ✅ | Chi tiết meeting |
| `DELETE` | `/api/meetings/{code}` | ✅ | Hủy meeting (owner) |
| `POST` | `/api/meetings/{code}/join` | ✅ | Tham gia phòng |
| `POST` | `/api/meetings/{code}/leave` | ✅ | Rời phòng |
| `POST` | `/api/meetings/{code}/end` | ✅ | Kết thúc cho tất cả (host) |
| `GET` | `/api/meetings/{code}/info` | ✅ | Thông tin cơ bản phòng (trước khi join) |
| `GET` | `/api/meetings/{code}/waiting-room` | ✅ | Danh sách người chờ duyệt |
| `POST` | `/api/meetings/{code}/approval` | ✅ | Duyệt / từ chối participant |
| `GET` | `/api/meetings/{code}/settings` | ✅ | Lấy cài đặt phòng |
| `PUT` | `/api/meetings/{code}/settings` | ✅ | Cập nhật cài đặt phòng |
| `GET` | `/api/meetings/{code}/summary` | ✅ | Tóm tắt sau họp |
| `GET` | `/api/meetings/{code}/chat/history` | ✅ | Lịch sử chat (forward sang Chat Service) |
| `POST` | `/api/meetings/{code}/feedback` | ✅ | Gửi đánh giá |

---

## 8. Business Rules Quan Trọng

1. **Owner vs Host**: `ownerId` bất biến. `hostId` có thể thay đổi khi transfer.
2. **Auto-finish**: Meeting tự động FINISHED khi không còn ai ACTIVE.
3. **Kicked rejoining**: Participant bị kick phải qua waiting room lại lần join tiếp theo.
4. **Owner bypass waiting room**: Owner và Host runtime luôn APPROVED, không vào waiting room.
5. **TransientObjectException**: Luôn `save()` Participant trước khi tạo và liên kết ParticipantSession.
6. **Feedback once**: Mỗi user chỉ được gửi 1 feedback/meeting.
7. **Chat history access**: Chỉ owner và active participant đang họp mới xem được lịch sử chat đầy đủ.
8. **Outbox pattern**: Khi schedule meeting có invitations → ghi vào `outbox_events` trong cùng DB transaction để Kafka worker gửi email sau.

---

## 9. Tích Hợp Với Các Service Khác

| Service | Cơ chế | Mục đích |
|---|---|---|
| Identity Service | HTTP (Feign) — Internal | Lấy thông tin user (tên, avatar) để hiển thị host_name trong `/info` |
| Media Service | HTTP (Feign) — Sync | Gọi start/stop recording, nhận kết quả |
| Chat Service | HTTP (Feign) — Sync | Lấy chat history, đếm số messages (cho summary) |
| Kafka | Async | Publish event `MEETING_SCHEDULED` → Notification Service gửi email mời |
| LiveKit | HTTP SDK | Tạo join token cho participant |
