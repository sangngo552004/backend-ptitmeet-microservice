# 05. Media Service — Đặc Tả Chi Tiết

**Port**: 8084  
**Database**: MySQL — `ptitmeet_media_db`  
**Vai trò**: Quản lý ghi hình (Recording), tương tác trực tiếp với LiveKit Egress API, lưu trữ file lên Cloudflare R2/S3.

---

## 1. Trách Nhiệm

| Chức năng | Mô tả |
|---|---|
| Bắt đầu ghi hình | Gọi LiveKit `startRoomCompositeEgress`, lưu metadata recording |
| Dừng ghi hình | Gọi LiveKit `stopEgress` theo `egressId` |
| Nhận LiveKit Webhook | Xử lý sự kiện `EGRESS_ENDED` để cập nhật status và `fileUrl` |
| Xem danh sách recording | Trả về recordings của owner |
| Kiểm tra trạng thái | Truy vấn trạng thái egress hiện tại từ LiveKit |
| Bù trừ (Compensating Transaction) | Xóa recording nếu Meeting Service rollback |

---

## 2. Database Schema — `ptitmeet_media_db`

### Bảng `meeting_recordings`

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK AUTO_INCREMENT | Định danh bản ghi |
| `room_name` | VARCHAR(100) | NOT NULL | Tên phòng LiveKit = `meeting_code` |
| `egress_id` | VARCHAR(255) | UNIQUE, NOT NULL | ID kỹ thuật của phiên egress trong LiveKit |
| `meeting_id` | UUID | NOT NULL | UUID thô — không FK sang meeting DB |
| `owner_id` | UUID | NOT NULL | UUID thô — chỉ owner mới ghi được |
| `status` | ENUM | NOT NULL | `RECORDING`, `COMPLETED`, `FAILED` |
| `file_url` | TEXT | NULLABLE | URL file video trên Cloudflare R2/S3 (sau khi COMPLETED) |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm bắt đầu recording |
| `completed_at` | TIMESTAMP | NULLABLE | Thời điểm kết thúc |

**Index khuyến nghị**:
- `{ owner_id: 1, created_at: DESC }` — Query danh sách recording của owner.
- `{ egress_id: 1 }` — Map webhook callback về đúng bản ghi.
- `{ meeting_id: 1 }` — Lấy recording theo meetingId.

---

## 3. Trạng Thái Recording

```
[Start Recording API]
        │
        ▼
   RECORDING  ──(LiveKit Webhook: EGRESS_ENDED success)──► COMPLETED
        │
        └──────(LiveKit Webhook: EGRESS_ENDED failure)──► FAILED
```

---

## 4. Luồng Start Recording

```
1. Meeting Service gọi: POST /api/media/recordings/start?meetingCode={code}
   (header: X-User-Id = userId của người gọi)

2. Media Service kiểm tra:
   - User có phải owner của meeting không?
     → Gọi Meeting Service (internal) để lấy meeting.ownerId
     → So sánh với X-User-Id
     → Nếu không phải owner: trả lỗi 403 FORBIDDEN

3. Gọi LiveKit Egress API: startRoomCompositeEgress(roomName, s3Config)
   → Nhận về egressId

4. Lưu vào DB:
   INSERT meeting_recordings (room_name, egress_id, meeting_id, owner_id, status='RECORDING')

5. Trả về MeetingRecording entity cho Meeting Service

6. Meeting Service broadcast STOMP event RECORDING_STARTED cho toàn phòng
```

---

## 5. Luồng Stop Recording

```
1. Meeting Service gọi: POST /api/media/recordings/stop?egressId={id}

2. Media Service gọi LiveKit: stopEgress(egressId)

3. LiveKit xử lý egress, upload file lên R2/S3

4. LiveKit gọi webhook về: POST /api/livekit/webhook
   Body: { event: "egress_ended", egressId, status, fileUrl }

5. Media Service cập nhật DB:
   UPDATE meeting_recordings SET status='COMPLETED', file_url=..., completed_at=now()
   WHERE egress_id = {egressId}

6. Meeting Service broadcast STOMP event RECORDING_STOPPED
```

---

## 6. Xử Lý LiveKit Webhook

**Endpoint**: `POST /api/livekit/webhook`  
**Không yêu cầu JWT** — Xác thực bằng LiveKit webhook secret riêng.

### Các Event Xử Lý

| Event | Hành động |
|---|---|
| `egress_ended` (status=COMPLETE) | Update `status=COMPLETED`, `file_url`, `completed_at` |
| `egress_ended` (status=FAILED) | Update `status=FAILED`, log lỗi |
| Các event khác | Bỏ qua (log debug) |

### Xác Thực Webhook Request

LiveKit ký request bằng HMAC. Media Service verify bằng `livekit.webhook-secret`:

```java
WebhookReceiver receiver = new WebhookReceiver(apiKey, apiSecret);
WebhookEvent event = receiver.receive(body, authHeader);
```

---

## 7. Compensating Transaction

Khi Meeting Service gặp lỗi **sau khi** đã gọi Media Service thành công để start recording:

```
Meeting Service rollback local DB
        │
        └── Gọi: DELETE /api/media/recordings/{egressId}  (Compensating Call)
                   │
                   └── Media Service:
                         1. Gọi LiveKit stopEgress(egressId) nếu còn RECORDING
                         2. Xóa bản ghi trong DB
                         3. Trả về 200 OK
```

---

## 8. Cấu Hình LiveKit & Cloudflare R2

**LiveKit Egress Config** (lưu trong application.yml):
```yaml
livekit:
  host: https://your-livekit-server.com
  api-key: API_KEY
  api-secret: API_SECRET
  webhook-secret: WEBHOOK_SECRET

storage:
  type: S3  # Cloudflare R2 compatible
  bucket: ptitmeet-recordings
  endpoint: https://<account-id>.r2.cloudflarestorage.com
  access-key: R2_ACCESS_KEY
  secret-key: R2_SECRET_KEY
  region: auto
```

---

## 9. API Endpoints

**Base path**: `/api/livekit`

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/api/livekit/recordings/start` | ✅ (qua header) | Bắt đầu ghi hình |
| `POST` | `/api/livekit/recordings/stop` | ✅ | Dừng ghi hình theo `egressId` |
| `GET` | `/api/livekit/recordings/my` | ✅ | Danh sách recording của tôi (owner) |
| `GET` | `/api/livekit/recordings/status` | ✅ | Trạng thái egress theo `egressId` |
| `POST` | `/api/livekit/webhook` | ❌ JWT (webhook secret) | Nhận callback từ LiveKit |
| `DELETE` | `/api/livekit/recordings/{egressId}` | Internal | Compensating transaction |

---

## 10. Business Rules Quan Trọng

1. **Chỉ owner mới được record**: Media Service luôn verify `X-User-Id == meeting.ownerId`.
2. **1 egress = 1 room**: Mỗi phòng chỉ có 1 egress active cùng lúc (LiveKit giới hạn).
3. **Webhook là nguồn sự thật**: Trạng thái `COMPLETED`/`FAILED` và `file_url` chỉ được cập nhật qua webhook — không manually set.
4. **file_url**: URL trực tiếp tới Cloudflare R2, không qua CDN trong giai đoạn học tập.
5. **egressId**: Là khóa duy nhất để map webhook về đúng bản ghi. Luôn index column này.

---

## 11. Tích Hợp Với Các Service Khác

| Service | Cơ chế | Mục đích |
|---|---|---|
| Meeting Service | HTTP (được gọi) | Meeting Service gọi start/stop recording |
| Meeting Service | HTTP (gọi ra) | Verify `ownerId` của meeting trước khi start recording |
| LiveKit | HTTP SDK | Gọi Egress API |
| Cloudflare R2 | S3-compatible SDK | Lưu file video (do LiveKit Egress tự upload) |
| API Gateway | HTTP passthrough | Expose webhook endpoint ra ngoài cho LiveKit callback |
