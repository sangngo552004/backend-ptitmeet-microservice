# 07. Database Design — Toàn Hệ Thống

## Nguyên Tắc Thiết Kế

> **Database per Service**: Mỗi service sở hữu database riêng biệt, không chia sẻ schema.  
> **No Hard Foreign Keys giữa service**: Liên kết chéo giữa các domain chỉ bằng Raw UUID (loose coupling).  
> **Internal FK**: Bên trong cùng một service DB, vẫn sử dụng FK bình thường.

---

## 1. Identity DB — `ptitmeet_identity_db` (MySQL)

```sql
-- =============================================
-- TABLE: users
-- =============================================
CREATE TABLE users (
    user_id     CHAR(36)     NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,           -- NULL nếu Google OAuth
    full_name   VARCHAR(100) NOT NULL,
    avatar_url  TEXT         NULL,
    auth_provider ENUM('LOCAL', 'GOOGLE') NOT NULL DEFAULT 'LOCAL',
    provider_id VARCHAR(255) NULL,             -- Google sub ID
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    INDEX idx_email (email)
);

-- =============================================
-- TABLE: refresh_tokens
-- =============================================
CREATE TABLE refresh_tokens (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     CHAR(36)     NOT NULL,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP    NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_id (user_id)
);

-- =============================================
-- TABLE: password_reset_tokens
-- =============================================
CREATE TABLE password_reset_tokens (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     CHAR(36)     NOT NULL,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP    NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

---

## 2. Meeting DB — `ptitmeet_meeting_db` (MySQL)

```sql
-- =============================================
-- TABLE: meetings
-- =============================================
CREATE TABLE meetings (
    meeting_id   CHAR(36)     NOT NULL,
    host_id      CHAR(36)     NOT NULL,          -- Raw UUID, NO FK
    owner_id     CHAR(36)     NOT NULL,          -- Raw UUID, NO FK
    meeting_code VARCHAR(20)  NOT NULL UNIQUE,   -- VD: "abc-defg-hij"
    title        VARCHAR(255) NULL,
    password     VARCHAR(255) NULL,
    is_instant   BOOLEAN      NOT NULL DEFAULT FALSE,
    start_time   TIMESTAMP    NULL,
    end_time     TIMESTAMP    NULL,
    access_type  ENUM('OPEN', 'TRUSTED', 'RESTRICTED') NOT NULL DEFAULT 'OPEN',
    allowed_domain VARCHAR(255) NULL,            -- Cho TRUSTED access type
    status       ENUM('SCHEDULED','ACTIVE','FINISHED','CANCELED') NOT NULL DEFAULT 'SCHEDULED',
    settings     JSON         NULL,              -- Meeting settings JSON
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (meeting_id),
    INDEX idx_meeting_code (meeting_code),
    INDEX idx_owner_id (owner_id),
    INDEX idx_host_id (host_id),
    INDEX idx_status (status)
);

-- =============================================
-- TABLE: participants
-- =============================================
CREATE TABLE participants (
    participant_id  CHAR(36)     NOT NULL,
    meeting_id      CHAR(36)     NOT NULL,        -- FK nội bộ
    user_id         CHAR(36)     NOT NULL,         -- Raw UUID, NO FK tới identity DB
    display_name    VARCHAR(255) NOT NULL,
    role            ENUM('HOST', 'GUEST') NOT NULL DEFAULT 'GUEST',
    approval_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (participant_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    UNIQUE INDEX idx_meeting_user (meeting_id, user_id),   -- 1 user / 1 meeting
    INDEX idx_user_id (user_id)
);

-- =============================================
-- TABLE: participant_sessions
-- =============================================
CREATE TABLE participant_sessions (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    participant_id CHAR(36)     NOT NULL,          -- FK nội bộ
    joined_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at        TIMESTAMP    NULL,
    status         ENUM('ACTIVE','LEFT','KICKED','ENDED_BY_HOST') NOT NULL DEFAULT 'ACTIVE',
    device_info    TEXT         NULL,              -- User-Agent string
    ip_address     VARCHAR(50)  NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (participant_id) REFERENCES participants(participant_id) ON DELETE CASCADE,
    INDEX idx_participant_id (participant_id),
    INDEX idx_status (status)
);

-- =============================================
-- TABLE: meeting_invitations
-- =============================================
CREATE TABLE meeting_invitations (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    meeting_id  CHAR(36)     NOT NULL,
    email       VARCHAR(255) NOT NULL,
    user_id     CHAR(36)     NULL,               -- Raw UUID, NULL nếu user chưa đăng ký
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    INDEX idx_meeting_email (meeting_id, email)
);

-- =============================================
-- TABLE: meeting_feedbacks
-- =============================================
CREATE TABLE meeting_feedbacks (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    meeting_id  CHAR(36)     NOT NULL,
    user_id     CHAR(36)     NOT NULL,            -- Raw UUID
    rating      TINYINT      NOT NULL,            -- 1-5
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    UNIQUE INDEX idx_meeting_user_feedback (meeting_id, user_id)  -- 1 feedback / user / meeting
);

-- =============================================
-- TABLE: outbox_events  (Transactional Outbox Pattern)
-- =============================================
CREATE TABLE outbox_events (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    aggregate_type VARCHAR(50)  NOT NULL,          -- 'MEETING'
    aggregate_id   CHAR(36)     NOT NULL,          -- meeting_id
    event_type     VARCHAR(100) NOT NULL,          -- 'MEETING_SCHEDULED', 'INVITATION_SENT'
    payload        JSON         NOT NULL,
    status         ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at   TIMESTAMP    NULL,
    PRIMARY KEY (id),
    INDEX idx_status (status),
    INDEX idx_aggregate (aggregate_type, aggregate_id)
);
```

---

## 3. Chat DB — `ptitmeet_chat_db` (MongoDB)

```javascript
// Collection: meeting_chats
// Document Schema:
{
  _id:          ObjectId,          // Auto-generated
  meeting_code: String,            // "abc-defg-hij" — loose link
  sender_id:    String,            // UUID thô của người gửi
  sender_name:  String,            // Tên hiển thị tại thời điểm gửi
  content:      String,            // Nội dung tin nhắn
  timestamp:    Date               // ISODate
}

// Indexes:
db.meeting_chats.createIndex({ meeting_code: 1, timestamp: 1 })  // Query + sort
db.meeting_chats.createIndex({ sender_id: 1 })                   // Query by user
```

---

## 4. Media DB — `ptitmeet_media_db` (MySQL)

```sql
-- =============================================
-- TABLE: meeting_recordings
-- =============================================
CREATE TABLE meeting_recordings (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    room_name    VARCHAR(100) NOT NULL,             -- = meeting_code trong LiveKit
    egress_id    VARCHAR(255) NOT NULL UNIQUE,      -- LiveKit egress ID
    meeting_id   CHAR(36)     NOT NULL,             -- Raw UUID, NO FK
    owner_id     CHAR(36)     NOT NULL,             -- Raw UUID, NO FK
    status       ENUM('RECORDING','COMPLETED','FAILED') NOT NULL DEFAULT 'RECORDING',
    file_url     TEXT         NULL,                 -- URL sau khi COMPLETED
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP    NULL,
    PRIMARY KEY (id),
    INDEX idx_egress_id (egress_id),
    INDEX idx_owner_id (owner_id),
    INDEX idx_meeting_id (meeting_id)
);
```

---

## 5. Sơ Đồ Quan Hệ Giữa Các DB (Loose Coupling)

```
ptitmeet_identity_db              ptitmeet_meeting_db
┌─────────────┐                  ┌─────────────────────┐
│   users     │                  │   meetings           │
│  user_id PK │◄ ─ ─ ─ ─ ─ ─ ─ ┤  owner_id (raw UUID) │
└─────────────┘   (loose ref)   │  host_id  (raw UUID) │
                                 ├─────────────────────┤
                                 │   participants       │
                                 │  user_id  (raw UUID) │
                                 ├─────────────────────┤
                                 │ meeting_invitations  │
                                 │  user_id  (raw UUID) │
                                 ├─────────────────────┤
                                 │  meeting_feedbacks   │
                                 │  user_id  (raw UUID) │
                                 └─────────────────────┘

ptitmeet_chat_db (MongoDB)        ptitmeet_media_db
┌─────────────────────┐          ┌────────────────────────┐
│   meeting_chats     │          │  meeting_recordings     │
│  sender_id (raw)    │          │  owner_id   (raw UUID)  │
│  meeting_code (raw) │          │  meeting_id (raw UUID)  │
└─────────────────────┘          └────────────────────────┘
```

---

## 6. Data Consistency Considerations

### Vấn đề: User đổi tên sau khi đã chat
- `sender_name` trong MongoDB được **snapshot tại thời điểm gửi**.
- Khi user cập nhật `full_name` trong Identity Service, chat history không tự động update — đây là thiết kế có chủ ý (immutable history).

### Vấn đề: Meeting bị xóa
- Nếu Meeting bị xóa, các bản ghi trong Chat DB (meeting_chats theo meeting_code) và Media DB (recording theo meeting_id) sẽ **không tự động xóa** do không có FK cứng.
- Cần có cơ chế cleanup riêng nếu muốn xóa triệt để (out of scope giai đoạn này).

### Vấn đề: Hiển thị tên host trong Meeting Info
- Meeting Service lưu `host_id` là UUID thô.
- Khi cần hiển thị `host_name` trong `/api/meetings/{code}/info`, Meeting Service gọi Identity Service qua internal HTTP để lấy `fullName`.
- Cần cache hoặc chấp nhận latency của inter-service call.
