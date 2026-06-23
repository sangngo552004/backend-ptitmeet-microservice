# 10. API Reference — Toàn Hệ Thống

## Quy Ước Chung

- **Base URL**: `http://localhost:8080` (API Gateway)
- **Auth**: `Authorization: Bearer <access_token>` (trừ các endpoint đánh dấu ❌)
- **Response format**: `{ "code": int, "message": string, "data": T }`
- **Content-Type**: `application/json`

---

## 1. Identity Service — `/api/auth`, `/api/users`

### Authentication

| Method | Endpoint | Auth | Request Body | Response Data |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | `RegisterRequest` | `UserResponse` |
| `POST` | `/api/auth/login` | ❌ | `LoginRequest` | `AuthResponse` |
| `POST` | `/api/auth/google` | ❌ | `GoogleLoginRequest` | `AuthResponse` |
| `POST` | `/api/auth/logout` | ✅ | — | `void` |
| `POST` | `/api/auth/refresh-token` | ❌ | — (cookie/body) | `AuthResponse` |
| `POST` | `/api/auth/forgot-password` | ❌ | `ForgotPasswordRequest` | `void` |
| `POST` | `/api/auth/reset-password` | ❌ | `ResetPasswordRequest` | `void` |

### User Profile

| Method | Endpoint | Auth | Request Body | Response Data |
|---|---|---|---|---|
| `GET` | `/api/users/me` | ✅ | — | `UserResponse` |
| `GET` | `/api/users/profile` | ✅ | — | `UserResponse` |
| `PUT` | `/api/users/profile` | ✅ | `UpdateProfileRequest` | `UserResponse` |
| `POST` | `/api/users/avatar` | ✅ | `multipart/form-data` | `UserResponse` |

---

## 2. Meeting Service — `/api/meetings`

### Meeting CRUD

| Method | Endpoint | Auth | Request Body / Params | Response Data |
|---|---|---|---|---|
| `POST` | `/api/meetings/instant` | ✅ | `CreateMeetingRequest?` | `Meeting` |
| `POST` | `/api/meetings/schedule` | ✅ | `CreateMeetingRequest` | `Meeting` |
| `GET` | `/api/meetings/my-meetings` | ✅ | — | `List<Meeting>` |
| `GET` | `/api/meetings/history` | ✅ | `?page=1&size=6&role=ALL&status=ALL` | `Page<MeetingHistoryResponse>` |
| `GET` | `/api/meetings/up-next` | ✅ | — | `MeetingHistoryResponse` |
| `GET` | `/api/meetings/{code}/info` | ✅ | — | `MeetingInfoResponse` |
| `DELETE` | `/api/meetings/{code}` | ✅ | — | `void` |
| `GET` | `/api/meetings/{code}/settings` | ✅ | — | `String (JSON)` |
| `PUT` | `/api/meetings/{code}/settings` | ✅ | `Map<String, Object>` | `Meeting` |

### Meeting Participation

| Method | Endpoint | Auth | Request Body | Response Data |
|---|---|---|---|---|
| `POST` | `/api/meetings/{code}/join` | ✅ | `JoinMeetingRequest?` | `JoinMeetingResponse` |
| `POST` | `/api/meetings/{code}/leave` | ✅ | — | `void` |
| `POST` | `/api/meetings/{code}/end` | ✅ | — | `void` |
| `GET` | `/api/meetings/{code}/waiting-room` | ✅ | — | `List<ParticipantResponse>` |
| `POST` | `/api/meetings/{code}/approval` | ✅ | `ApprovalRequest` | `void` |

### Post-Meeting

| Method | Endpoint | Auth | Request Body / Params | Response Data |
|---|---|---|---|---|
| `GET` | `/api/meetings/{code}/summary` | ✅ | `?action=LEAVE` | `MeetingSummaryResponse` |
| `GET` | `/api/meetings/{code}/chat/history` | ✅ | — | `List<ChatMessage>` |
| `POST` | `/api/meetings/{code}/feedback` | ✅ | `FeedbackRequest` | `void` |

---

## 3. Media Service — `/api/livekit`

| Method | Endpoint | Auth | Request Body / Params | Response Data |
|---|---|---|---|---|
| `POST` | `/api/livekit/recordings/start` | ✅ | `?meetingCode=abc` | `MeetingRecording` |
| `POST` | `/api/livekit/recordings/stop` | ✅ | `?egressId=xyz` | `void` |
| `GET` | `/api/livekit/recordings/my` | ✅ | — | `List<MeetingRecording>` |
| `GET` | `/api/livekit/recordings/status` | ✅ | `?egressId=xyz` | `Object` |
| `POST` | `/api/livekit/webhook` | ❌ JWT | (LiveKit signed body) | `String` |

---

## 4. WebSocket / STOMP Endpoints (qua Chat Service)

**Connect**: `ws://localhost:8080/ws` (với JWT token)

| Direction | Destination | Payload | Mô tả |
|---|---|---|---|
| Client→Server | `/app/chat/{meetingCode}` | `{ content }` | Gửi tin nhắn chat |
| Client→Server | `/app/meeting/{code}/system` | `SystemMessage` | Host actions |
| Server→Client | `/topic/chat/{meetingCode}` | `ChatMessage` | Broadcast tin nhắn mới |
| Server→Client | `/topic/meeting/{meetingCode}` | `SystemEvent` | System events (mute, kick, host transfer) |
| Server→Client | `/topic/meeting/{meetingCode}/host` | `JoinRequest` | Thông báo join request (chỉ host) |
| Server→Client | `/user/queue/approval` | `ApprovalResult` | Kết quả duyệt cho guest |

---

## 5. Schema Definitions

### `RegisterRequest`
```json
{
  "fullName": "string (2-100 chars)",
  "email": "string (valid email format)",
  "password": "string (min 8 chars)"
}
```

### `LoginRequest`
```json
{
  "email": "string",
  "password": "string"
}
```

### `GoogleLoginRequest`
```json
{
  "idToken": "string (Google ID token)"
}
```

### `AuthResponse`
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (UUID)",
  "user": "UserResponse"
}
```

### `UserResponse`
```json
{
  "userId": "UUID",
  "email": "string",
  "fullName": "string",
  "avatarUrl": "string | null",
  "authProvider": "LOCAL | GOOGLE"
}
```

### `CreateMeetingRequest`
```json
{
  "title": "string | null",
  "start_time": "ISO8601 datetime | null",
  "end_time": "ISO8601 datetime | null",
  "access_type": "OPEN | TRUSTED | RESTRICTED",
  "password": "string | null",
  "settings": "JSON string | null",
  "participant_emails": ["email1", "email2"]
}
```

### `Meeting`
```json
{
  "meetingId": "UUID",
  "meetingCode": "string",
  "title": "string | null",
  "hostId": "UUID",
  "ownerId": "UUID",
  "status": "SCHEDULED | ACTIVE | FINISHED | CANCELED",
  "accessType": "OPEN | TRUSTED | RESTRICTED",
  "isInstant": "boolean",
  "startTime": "ISO8601 | null",
  "endTime": "ISO8601 | null",
  "password": "string | null",
  "settings": "JSON string | null",
  "createdAt": "ISO8601"
}
```

### `JoinMeetingRequest`
```json
{
  "displayName": "string | null",
  "password": "string | null"
}
```

### `JoinMeetingResponse`
```json
{
  "status": "APPROVED | PENDING",
  "message": "string",
  "token": "string (LiveKit token) | null",
  "serverUrl": "string (LiveKit URL) | null",
  "role": "HOST | GUEST",
  "isOwner": "boolean",
  "currentHostId": "UUID",
  "settings": "JSON string | null"
}
```

### `ParticipantResponse`
```json
{
  "participantId": "UUID",
  "userId": "UUID",
  "displayName": "string",
  "email": "string",
  "avatarUrl": "string | null",
  "status": "PENDING | APPROVED | REJECTED",
  "requestTime": "ISO8601"
}
```

### `ApprovalRequest`
```json
{
  "participantId": "UUID",
  "action": "APPROVED | REJECTED"
}
```

### `MeetingInfoResponse`
```json
{
  "meeting_code": "string",
  "title": "string | null",
  "host_name": "string",
  "status": "SCHEDULED | ACTIVE | FINISHED | CANCELED",
  "access_type": "OPEN | TRUSTED | RESTRICTED",
  "is_password_protected": "boolean"
}
```

### `MeetingHistoryResponse`
```json
{
  "meetingCode": "string",
  "title": "string | null",
  "startTime": "ISO8601 | null",
  "endTime": "ISO8601 | null",
  "status": "string",
  "isHost": "boolean",
  "isOwner": "boolean",
  "canViewRecordings": "boolean",
  "canViewChatHistory": "boolean"
}
```

### `MeetingSummaryResponse`
```json
{
  "duration": "string (VD: '1h 30m')",
  "participants": "integer",
  "messages": "integer"
}
```

### `FeedbackRequest`
```json
{
  "rating": "integer (1-5)"
}
```

### `MeetingRecording`
```json
{
  "id": "long",
  "roomName": "string (meeting_code)",
  "egressId": "string",
  "meetingId": "UUID",
  "ownerId": "UUID",
  "status": "RECORDING | COMPLETED | FAILED",
  "fileUrl": "string | null",
  "createdAt": "ISO8601"
}
```

### `ChatMessage`
```json
{
  "id": "string (MongoDB ObjectId)",
  "meetingCode": "string",
  "senderId": "UUID",
  "senderName": "string",
  "content": "string",
  "timestamp": "ISO8601"
}
```

### `SystemMessage` (STOMP)
```json
{
  "action": "MUTE_ALL | STOP_CAMERA_ALL | KICK_ALL | MUTE_PARTICIPANT | STOP_CAMERA_PARTICIPANT | KICK_PARTICIPANT | RECORDING_STARTED | RECORDING_STOPPED",
  "targetUserId": "UUID | null",
  "egressId": "string | null"
}
```

### `UpdateProfileRequest`
```json
{
  "fullName": "string (2-100 chars)",
  "avatarUrl": "string | null"
}
```

### `ForgotPasswordRequest`
```json
{
  "email": "string (valid email)"
}
```

### `ResetPasswordRequest`
```json
{
  "token": "string (reset token)",
  "newPassword": "string (min 8 chars)"
}
```

---

## 6. Error Codes

| HTTP Status | Tình huống |
|---|---|
| `200` | Thành công |
| `400` | Request không hợp lệ (validation fail) |
| `401` | Không có hoặc JWT invalid/expired |
| `403` | Không có quyền (VD: không phải owner) |
| `404` | Resource không tồn tại |
| `409` | Conflict (VD: email đã tồn tại, đã gửi feedback) |
| `503` | Service đích không khả dụng |

---

## 7. LiveKit Integration Details

### Token Generation
- **Library**: `io.livekit:livekit-server` Java SDK
- **Room name**: = `meeting_code` (VD: `"abc-defg-hij"`)
- **Participant identity**: `userId` (UUID string)
- **Token claims**: `join room`, `publish audio/video/screen` (tùy role)

### Egress Config (Start Recording)
- **Type**: `RoomCompositeEgress`
- **Output**: S3/R2 upload
- **Room**: = `meeting_code`
- **File naming**: `{meeting_code}_{timestamp}.mp4`
