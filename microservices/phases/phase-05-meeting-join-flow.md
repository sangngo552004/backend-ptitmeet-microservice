# Phase 05 — Meeting Service: Join Flow (Nghiệp Vụ Phức Tạp Nhất)

## Mục Tiêu
Implement toàn bộ luồng `joinMeeting()` — đây là flow phức tạp nhất trong dự án, kết hợp nhiều điều kiện nghiệp vụ: access type check, waiting room, password, session history (kicked check), và cấp LiveKit token.

**Kết quả sau phase này**: Endpoint POST /api/meetings/{code}/join hoạt động đầy đủ với tất cả business cases.

---

## Tài Liệu Cần Đọc Trước

- `microservices/03-meeting-service.md` — Section 3 (Access Type & Waiting Room Logic), Section 4 (Join Meeting Flow Chi Tiết)
- `microservices/01-architecture.md` — Section 6 (Access Type), Section 6 (Approval Status), Section 7 (Session Status)
- `microservices/10-api-reference.md` — JoinMeetingRequest, JoinMeetingResponse schemas

---

## Tiền Điều Kiện

Phase 04 đã hoàn thành. Tất cả entities, repositories, và MeetingService skeleton đã có.

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang implement joinMeeting() cho Meeting Service. Đây là business logic phức tạp nhất của toàn bộ hệ thống PTITMeet. Đọc kỹ từng bước trước khi code.

### DTO MỚI

**JoinMeetingRequest.java**:
```java
public class JoinMeetingRequest {
    private String displayName;   // Optional, dùng khi user chưa set tên
    private String password;      // Optional, cần nếu meeting có password
}
```

**JoinMeetingResponse.java**:
```java
@Data @Builder
public class JoinMeetingResponse {
    private String status;          // "APPROVED" hoặc "PENDING"
    private String message;
    private String token;           // LiveKit token (null nếu PENDING)
    private String serverUrl;       // LiveKit WSS URL (null nếu PENDING)
    private String role;            // "HOST" hoặc "GUEST"
    private Boolean isOwner;
    private String currentHostId;
    private String settings;        // Meeting settings JSON
}
```

**ParticipantResponse.java** (dùng cho waiting room):
```java
@Data @Builder
public class ParticipantResponse {
    private String participantId;
    private String userId;
    private String displayName;
    private String email;       // TODO: lấy từ Identity Service (Phase 10), hiện tại để null
    private String avatarUrl;   // TODO: Phase 10
    private String status;      // ApprovalStatus
    private LocalDateTime requestTime;
}
```

### METHOD CHÍNH: joinMeeting()

```java
@Transactional
public JoinMeetingResponse joinMeeting(String userId, String userEmail,
                                        String meetingCode, JoinMeetingRequest req,
                                        HttpServletRequest httpRequest) {
```

Implement theo đúng thứ tự các bước sau:

#### BƯỚC 1: Tìm Meeting
```
Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
    .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
```

#### BƯỚC 2: Kiểm tra trạng thái Meeting
```
if (meeting.getStatus() == FINISHED || meeting.getStatus() == CANCELED) {
    throw new AppException(ErrorCode.MEETING_NOT_ACTIVE);
}
```

#### BƯỚC 3: Xác định vai trò người dùng
```java
boolean isOwner = userId.equals(meeting.getOwnerId());
boolean isRuntimeHost = userId.equals(meeting.getHostId());
boolean isPrivileged = isOwner || isRuntimeHost;
```

#### BƯỚC 4: Xử lý meeting SCHEDULED
```java
if (meeting.getStatus() == SCHEDULED) {
    if (!isPrivileged) {
        // Attendee vào quá sớm
        return JoinMeetingResponse.builder()
            .status("PENDING")
            .message("Meeting chưa bắt đầu. Vui lòng chờ host khai mạc.")
            .build();
    }
    // Host/Owner kích hoạt meeting
    meeting.setStatus(MeetingStatus.ACTIVE);
    meetingRepository.save(meeting);
}
```

#### BƯỚC 5: Kiểm tra Access Type (chỉ áp dụng nếu không phải privileged)
```java
if (!isPrivileged) {
    checkAccessType(meeting, userEmail);  // Tách thành method riêng
}
```

**Method checkAccessType(Meeting meeting, String userEmail)**:
```java
private void checkAccessType(Meeting meeting, String userEmail) {
    switch (meeting.getAccessType()) {
        case OPEN -> {} // Không cần check
        case TRUSTED -> {
            String domain = meeting.getAllowedDomain();
            if (domain == null || !userEmail.endsWith("@" + domain)) {
                throw new AppException(ErrorCode.ACCESS_DENIED);
            }
        }
        case RESTRICTED -> {
            boolean isInvited = meetingInvitationRepository
                .existsByMeetingAndEmail(meeting, userEmail);
            if (!isInvited) {
                throw new AppException(ErrorCode.ACCESS_DENIED);
            }
        }
    }
}
```

#### BƯỚC 6: Kiểm tra password (nếu meeting có password)
```java
if (meeting.getPassword() != null && !meeting.getPassword().isBlank()) {
    if (req.getPassword() == null ||
        !meeting.getPassword().equals(req.getPassword())) {
        // LƯU Ý: Nếu dùng hashed password thì bcrypt.matches()
        // Monolith lưu plain text, microservice có thể để plain hoặc hash
        // Quyết định: lưu plain text đơn giản cho giai đoạn này
        throw new AppException(ErrorCode.WRONG_PASSWORD);
    }
}
```

**LƯU Ý**: Skip kiểm tra password nếu isPrivileged = true (host/owner biết mật khẩu hoặc không cần).

#### BƯỚC 7: Tìm hoặc tạo Participant (QUAN TRỌNG - phải save trước)

```java
// Tìm participant cũ (nếu user đã từng vào phòng này)
Participant participant = participantRepository
    .findByMeetingAndUserId(meeting, userId)
    .orElse(null);

boolean isNewParticipant = (participant == null);

if (participant == null) {
    String displayName = resolveDisplayName(req.getDisplayName(), userId);
    participant = Participant.builder()
        .meeting(meeting)
        .userId(userId)
        .displayName(displayName)
        .role(isPrivileged ? Role.HOST : Role.GUEST)
        .approvalStatus(ApprovalStatus.PENDING)
        .build();
    // PHẢI SAVE trước khi tạo Session để tránh TransientObjectException
    participant = participantRepository.save(participant);
}
```

`resolveDisplayName()`: Ưu tiên req.displayName → nếu null dùng "Participant"

#### BƯỚC 8: Kiểm tra session history (Kicked check)

```java
// Lấy session gần nhất của participant này
Optional<ParticipantSession> latestSession = participantSessionRepository
    .findTopByParticipantOrderByJoinedAtDesc(participant);

if (latestSession.isPresent() &&
    latestSession.get().getStatus() == SessionStatus.KICKED) {
    // Người này đã bị kick. Phải xin lại qua waiting room, kể cả nếu không có waiting room
    // Reset về PENDING để đi qua waiting room flow
    participant.setApprovalStatus(ApprovalStatus.PENDING);
    participantRepository.save(participant);
    // Fall through sang BƯỚC 9 (waiting room logic)
}
```

#### BƯỚC 9: Xác định có vào thẳng hay vào waiting room

```java
// Parse settings JSON để lấy waitingRoom flag
boolean waitingRoomEnabled = parseWaitingRoomSetting(meeting.getSettings());

boolean shouldGoToWaiting =
    !isPrivileged &&  // Host/Owner luôn APPROVED
    waitingRoomEnabled &&  // Waiting room phải bật
    participant.getApprovalStatus() != ApprovalStatus.APPROVED;  // Chưa được approve trước đó
```

**Method parseWaitingRoomSetting(String settingsJson)**:
Parse JSON string, lấy field "waitingRoom" (boolean). Nếu null/parse lỗi → default true.
Dùng Jackson ObjectMapper.

#### BƯỚC 10A: Nếu PENDING (vào waiting room)

```java
if (shouldGoToWaiting) {
    participant.setApprovalStatus(ApprovalStatus.PENDING);
    participantRepository.save(participant);

    // Gửi STOMP notification cho host
    // (sendWaitingRoomNotification sẽ được implement ở Phase 06)
    // Hiện tại: để TODO comment
    // TODO: messagingTemplate.convertAndSend(
    //    "/topic/meeting/" + meetingCode + "/host",
    //    WaitingRoomNotification.builder()
    //        .action("JOIN_REQUEST")
    //        .participantId(participant.getParticipantId())
    //        .userId(userId)
    //        .displayName(participant.getDisplayName())
    //        .build()
    // );

    return JoinMeetingResponse.builder()
        .status("PENDING")
        .message("Yêu cầu của bạn đang chờ host phê duyệt.")
        .currentHostId(meeting.getHostId())
        .settings(meeting.getSettings())
        .build();
}
```

#### BƯỚC 10B: Nếu APPROVED

```java
// Set status APPROVED
participant.setApprovalStatus(ApprovalStatus.APPROVED);
participantRepository.save(participant);

// Đóng session ACTIVE cũ nếu có (rejoin case)
participantSessionRepository
    .findByParticipantAndStatus(participant, SessionStatus.ACTIVE)
    .ifPresent(oldSession -> {
        oldSession.setStatus(SessionStatus.LEFT);
        oldSession.setLeftAt(LocalDateTime.now());
        participantSessionRepository.save(oldSession);
    });

// Tạo session mới
ParticipantSession session = ParticipantSession.builder()
    .participant(participant)
    .status(SessionStatus.ACTIVE)
    .deviceInfo(httpRequest.getHeader("User-Agent"))
    .ipAddress(httpRequest.getRemoteAddr())
    .build();
participantSessionRepository.save(session);

// Cấp LiveKit token
boolean isHostForToken = isPrivileged;
String livekitToken = liveKitService.generateJoinToken(
    meetingCode, userId, participant.getDisplayName(), isHostForToken);

return JoinMeetingResponse.builder()
    .status("APPROVED")
    .message("Bạn đã được vào phòng họp.")
    .token(livekitToken)
    .serverUrl(liveKitService.getLivekitServerUrl())
    .role(participant.getRole().name())
    .isOwner(isOwner)
    .currentHostId(meeting.getHostId())
    .settings(meeting.getSettings())
    .build();
```

### REPOSITORY METHODS CẦN THÊM

```java
// MeetingRepository
Optional<Meeting> findByMeetingCode(String meetingCode);

// ParticipantRepository
Optional<Participant> findByMeetingAndUserId(Meeting meeting, String userId);
List<Participant> findByMeetingAndApprovalStatus(Meeting meeting, ApprovalStatus status);

// ParticipantSessionRepository
Optional<ParticipantSession> findTopByParticipantOrderByJoinedAtDesc(Participant participant);
Optional<ParticipantSession> findByParticipantAndStatus(Participant participant, SessionStatus status);
List<ParticipantSession> findByParticipant_Meeting_MeetingCodeAndStatus(
    String meetingCode, ParticipantSession.SessionStatus status);

// MeetingInvitationRepository
boolean existsByMeetingAndEmail(Meeting meeting, String email);
```

### CONTROLLER: Thêm Endpoint Join

```java
@PostMapping("/{code}/join")
public ResponseEntity<ApiResponse<JoinMeetingResponse>> joinMeeting(
    @PathVariable String code,
    @RequestBody(required = false) JoinMeetingRequest req,
    HttpServletRequest request) {
    String userId = request.getHeader("X-User-Id");
    String userEmail = request.getHeader("X-User-Email");
    if (req == null) req = new JoinMeetingRequest();
    return ResponseEntity.ok(ApiResponse.success(
        meetingService.joinMeeting(userId, userEmail, code, req, request)));
}

@GetMapping("/{code}/waiting-room")
public ResponseEntity<ApiResponse<List<ParticipantResponse>>> getWaitingRoom(
    @PathVariable String code,
    HttpServletRequest request) {
    String userId = request.getHeader("X-User-Id");
    // Chỉ host mới xem được
    return ResponseEntity.ok(ApiResponse.success(
        meetingService.getWaitingRoom(userId, code)));
}
```

**getWaitingRoom()**: Tìm meeting, verify userId == hostId, trả participants có status=PENDING.

### KIỂM TRA KẾT QUẢ (Test nhiều scenario)

1. POST /join với meeting không tồn tại → 404 code 4041
2. POST /join với meeting FINISHED/CANCELED → 409 code 4093
3. POST /join với meeting SCHEDULED + userId != host → response PENDING "chờ host"
4. POST /join với meeting SCHEDULED + userId = owner → meeting chuyển ACTIVE, response APPROVED + token
5. POST /join với RESTRICTED meeting + email không được mời → 422 code 4222
6. POST /join với TRUSTED meeting + email sai domain → 422 code 4222
7. POST /join với meeting có password + sai password → 422 code 4221
8. POST /join với waitingRoom=true + guest → PENDING response
9. POST /join với waitingRoom=false + guest → APPROVED + LiveKit token
10. POST /join với participant đã KICKED → PENDING (phải qua waiting room lại)
11. POST /join với user đã APPROVED trước → APPROVED + token (rejoin)
12. GET /waiting-room với userId = hostId → list participants PENDING
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- joinMeeting() với tất cả business cases
- getWaitingRoom() (chỉ list, chưa có STOMP notification)
- Các repository methods cần thiết

❌ KHÔNG làm trong phase này:
- STOMP notification (TODO comment, Phase 06)
- Approval action (Phase 06)
- leaveMeeting, endForAll (Phase 06)
- gRPC calls (Phase 10)
