# Phase 06 — Meeting Service: Leave, Host Controls, Approval & WebSocket

## Mục Tiêu
Implement: leaveMeeting (auto-finish + host transfer), endForAll, approval endpoint, và tất cả WebSocket/STOMP events (host controls, waiting room notifications, approval responses).

**Kết quả sau phase này**: Meeting Service hoàn chỉnh real-time: host controls hoạt động qua WebSocket, approval flow end-to-end.

---

## Tài Liệu Cần Đọc Trước

- `microservices/03-meeting-service.md` — Section 5 (Leave & Host Transfer), Section 6 (Host Controls)
- `microservices/09-websocket-design.md` — Toàn bộ STOMP flow
- `microservices/10-api-reference.md` — ApprovalRequest, SystemMessage schemas

---

## Tiền Điều Kiện

Phase 04 và 05 hoàn thành. Meeting Service đã có entities, join flow.

**QUAN TRỌNG VỀ STOMP TRONG MICROSERVICE**: Trong kiến trúc này, Chat Service sở hữu STOMP broker. Tuy nhiên trong phase này ta dùng chiến lược đơn giản hơn: Meeting Service cũng tích hợp WebSocket/STOMP broker riêng để phục vụ host controls và approval.

Lý do: Meeting Service cần broadcast system events ngay khi REST API được gọi (leave, endForAll, approval). Nếu phải gọi Chat Service qua gRPC → thêm complexity cho Phase 10. Do đó:
- **Chat messages** → Chat Service STOMP broker (người dùng subscribe `/topic/chat/...`)
- **System events (host controls, approval)** → Meeting Service STOMP broker (người dùng subscribe `/topic/meeting/...`)

Client frontend sẽ cần 2 WebSocket connections hoặc Gateway routing theo path prefix.

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang implement phần real-time (WebSocket/STOMP) và các business flow phức tạp của Meeting Service.

### BƯỚC 1: Thêm STOMP Config vào Meeting Service

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-meeting")  // Dùng path khác với Chat Service
            .setAllowedOriginPatterns("*")
            .withSockJS();
    }
}
```

Update Gateway routing: thêm route `/ws-meeting/**` → meeting-service.

### BƯỚC 2: Các Event DTO

```java
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class SystemEvent {
    private String action;
    private String targetUserId;
    private String egressId;
    private String newHostId;
    private String newHostName;
}

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class WaitingRoomNotification {
    private String action;       // "JOIN_REQUEST"
    private String participantId;
    private String userId;
    private String displayName;
    private LocalDateTime requestTime;
}

@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class ApprovalResult {
    private String action;       // "APPROVED" hoặc "REJECTED"
    private String token;
    private String serverUrl;
    private String role;
    private String message;
}
```

### BƯỚC 3: STOMP Controller cho Host Controls

```java
@Controller
@RequiredArgsConstructor
public class MeetingSystemController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MeetingService meetingService;

    // Host gửi lệnh điều khiển
    @MessageMapping("/meeting/{code}/system")
    public void handleSystemAction(
        @DestinationVariable String code,
        @Payload SystemMessage message,
        SimpMessageHeaderAccessor headerAccessor) {

        // Lấy userId từ WebSocket session attributes
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");

        meetingService.handleSystemAction(userId, code, message);
    }
}
```

**SystemMessage DTO** (từ client):
```java
@Data
public class SystemMessage {
    private String action;         // "MUTE_ALL", "KICK_PARTICIPANT", etc.
    private String targetUserId;
    private String egressId;
}
```

**MeetingService.handleSystemAction()**:
1. Tìm meeting theo code
2. Verify sender là hostId → throw ONLY_HOST nếu không phải
3. Nếu action = KICK_PARTICIPANT: tìm active session của targetUserId, set KICKED
4. Broadcast event tới `/topic/meeting/{code}`:
```java
messagingTemplate.convertAndSend("/topic/meeting/" + code,
    SystemEvent.builder().action(message.getAction())
        .targetUserId(message.getTargetUserId()).build());
```

Các actions hỗ trợ: MUTE_ALL, STOP_CAMERA_ALL, MUTE_PARTICIPANT, STOP_CAMERA_PARTICIPANT, KICK_PARTICIPANT
(RECORDING_STARTED, RECORDING_STOPPED → broadcast nhưng không cần xử lý DB ở đây)

### BƯỚC 4: leaveMeeting()

```java
@Transactional
public void leaveMeeting(String userId, String meetingCode) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    if (meeting.getStatus() != MeetingStatus.ACTIVE) {
        return; // Không làm gì nếu meeting không active
    }

    // 1. Tìm participant và active session
    Participant participant = participantRepository
        .findByMeetingAndUserId(meeting, userId)
        .orElseThrow(() -> new AppException(ErrorCode.PARTICIPANT_NOT_FOUND));

    ParticipantSession session = participantSessionRepository
        .findByParticipantAndStatus(participant, SessionStatus.ACTIVE)
        .orElse(null);

    if (session != null) {
        session.setStatus(SessionStatus.LEFT);
        session.setLeftAt(LocalDateTime.now());
        participantSessionRepository.save(session);
    }

    // 2. Kiểm tra còn ai active không
    long activeCount = participantSessionRepository
        .countByParticipant_Meeting_MeetingCodeAndStatus(meetingCode, SessionStatus.ACTIVE);

    if (activeCount == 0) {
        // Auto-finish meeting
        meeting.setStatus(MeetingStatus.FINISHED);
        meeting.setEndTime(LocalDateTime.now());
        meetingRepository.save(meeting);
        return;
    }

    // 3. Nếu người rời là hostId → transfer host
    if (userId.equals(meeting.getHostId())) {
        // Tìm participant active tiếp theo (không phải người vừa rời)
        Optional<ParticipantSession> nextSessionOpt = participantSessionRepository
            .findFirstByParticipant_Meeting_MeetingCodeAndStatusAndParticipant_UserIdNot(
                meetingCode, SessionStatus.ACTIVE, userId);

        nextSessionOpt.ifPresent(nextSession -> {
            String newHostId = nextSession.getParticipant().getUserId();
            String newHostName = nextSession.getParticipant().getDisplayName();

            meeting.setHostId(newHostId);
            meetingRepository.save(meeting);

            // Broadcast HOST_TRANSFERRED
            messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
                SystemEvent.builder()
                    .action("HOST_TRANSFERRED")
                    .newHostId(newHostId)
                    .newHostName(newHostName)
                    .build());
        });
    }
}
```

**Repository methods cần thêm**:
```java
long countByParticipant_Meeting_MeetingCodeAndStatus(
    String meetingCode, SessionStatus status);

Optional<ParticipantSession> findFirstByParticipant_Meeting_MeetingCodeAndStatusAndParticipant_UserIdNot(
    String meetingCode, SessionStatus status, String excludeUserId);
```

### BƯỚC 5: endForAll()

```java
@Transactional
public void endForAll(String userId, String meetingCode) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    // Chỉ host runtime mới được end for all
    if (!userId.equals(meeting.getHostId())) {
        throw new AppException(ErrorCode.ONLY_HOST);
    }

    // Set tất cả ACTIVE sessions thành ENDED_BY_HOST
    List<ParticipantSession> activeSessions = participantSessionRepository
        .findAllByParticipant_Meeting_MeetingCodeAndStatus(meetingCode, SessionStatus.ACTIVE);

    activeSessions.forEach(s -> {
        s.setStatus(SessionStatus.ENDED_BY_HOST);
        s.setLeftAt(LocalDateTime.now());
    });
    participantSessionRepository.saveAll(activeSessions);

    // Finish meeting
    meeting.setStatus(MeetingStatus.FINISHED);
    meeting.setEndTime(LocalDateTime.now());
    meetingRepository.save(meeting);

    // Broadcast END_MEETING event
    messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
        SystemEvent.builder().action("END_MEETING_FOR_ALL").build());
}
```

### BƯỚC 6: approveParticipant()

```java
@Data
public class ApprovalRequest {
    @NotBlank
    private String participantId;
    @NotBlank
    private String action;  // "APPROVED" hoặc "REJECTED"
}
```

```java
@Transactional
public void approveParticipant(String hostUserId, String meetingCode, ApprovalRequest req) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    // Chỉ host mới approve
    if (!hostUserId.equals(meeting.getHostId())) {
        throw new AppException(ErrorCode.ONLY_HOST);
    }

    Participant participant = participantRepository.findById(req.getParticipantId())
        .orElseThrow(() -> new AppException(ErrorCode.PARTICIPANT_NOT_FOUND));

    if ("APPROVED".equals(req.getAction())) {
        participant.setApprovalStatus(ApprovalStatus.APPROVED);
        participantRepository.save(participant);

        // Tạo session mới
        ParticipantSession session = ParticipantSession.builder()
            .participant(participant)
            .status(SessionStatus.ACTIVE)
            .build();
        participantSessionRepository.save(session);

        // Cấp LiveKit token
        String token = liveKitService.generateJoinToken(
            meetingCode, participant.getUserId(),
            participant.getDisplayName(), false);

        // Gửi private message tới user đang chờ
        messagingTemplate.convertAndSendToUser(
            participant.getUserId(),
            "/queue/approval",
            ApprovalResult.builder()
                .action("APPROVED")
                .token(token)
                .serverUrl(liveKitService.getLivekitServerUrl())
                .role("GUEST")
                .message("Bạn đã được vào phòng.")
                .build()
        );

    } else if ("REJECTED".equals(req.getAction())) {
        participant.setApprovalStatus(ApprovalStatus.REJECTED);
        participantRepository.save(participant);

        messagingTemplate.convertAndSendToUser(
            participant.getUserId(),
            "/queue/approval",
            ApprovalResult.builder()
                .action("REJECTED")
                .message("Yêu cầu của bạn đã bị từ chối bởi host.")
                .build()
        );
    }
}
```

**LƯU Ý về convertAndSendToUser**: SimpMessagingTemplate cần biết user's session. User phải đăng ký với WebSocket dưới identity là userId. Cần configure WebSocket HandshakeInterceptor để set "userId" vào session attributes khi WebSocket connect.

**WebSocket HandshakeInterceptor** (thêm vào WebSocketConfig):
```java
@Override
public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws-meeting")
        .setAllowedOriginPatterns("*")
        .addInterceptors(new HttpSessionHandshakeInterceptor() {
            @Override
            public boolean beforeHandshake(ServerHttpRequest request, ...) {
                // Lấy userId từ query param "userId" hoặc parse từ token
                // Đơn giản: client gửi ?userId=xxx khi connect
                String query = request.getURI().getQuery();
                // parse userId từ query
                Map<String, Object> attrs = new HashMap<>();
                attrs.put("userId", parsedUserId);
                return true;
            }
        })
        .withSockJS();
}
```

Cách đơn giản hơn: dùng Principal từ JWT trong STOMP CONNECT frame. Client gửi token trong STOMP CONNECT header, server parse và tạo Principal.

### BƯỚC 7: Hoàn thiện joinMeeting() với STOMP notification

Quay lại Phase 05, bỏ comment TODO và thêm:
```java
// Sau khi set PENDING, gửi notification cho host
messagingTemplate.convertAndSend(
    "/topic/meeting/" + meetingCode + "/host",
    WaitingRoomNotification.builder()
        .action("JOIN_REQUEST")
        .participantId(participant.getParticipantId())
        .userId(userId)
        .displayName(participant.getDisplayName())
        .requestTime(LocalDateTime.now())
        .build()
);
```

### BƯỚC 8: Thêm Endpoints vào Controller

```java
@PostMapping("/{code}/leave")
public ResponseEntity<ApiResponse<Void>> leave(@PathVariable String code, HttpServletRequest req) {
    meetingService.leaveMeeting(req.getHeader("X-User-Id"), code);
    return ResponseEntity.ok(ApiResponse.success(null));
}

@PostMapping("/{code}/end")
public ResponseEntity<ApiResponse<Void>> endForAll(@PathVariable String code, HttpServletRequest req) {
    meetingService.endForAll(req.getHeader("X-User-Id"), code);
    return ResponseEntity.ok(ApiResponse.success(null));
}

@PostMapping("/{code}/approval")
public ResponseEntity<ApiResponse<Void>> approveParticipant(
    @PathVariable String code,
    @Valid @RequestBody ApprovalRequest request,
    HttpServletRequest req) {
    meetingService.approveParticipant(req.getHeader("X-User-Id"), code, request);
    return ResponseEntity.ok(ApiResponse.success(null));
}
```

### BƯỚC 9: Update Gateway routing

Thêm vào GatewayConfig:
```java
.route("meeting-service-ws", r -> r
    .path("/ws-meeting/**")
    .filters(f -> f.filter(jwtAuthFilterFactory.apply(
        new JwtAuthFilterFactory.Config(true))))  // WebSocket dùng token riêng
    .uri("lb:ws://meeting-service"))
```

### KIỂM TRA KẾT QUẢ

1. POST /leave với userId active → session = LEFT, nếu cuối cùng meeting = FINISHED
2. POST /leave với userId = hostId, còn người khác → HOST_TRANSFERRED broadcast
3. POST /end với userId = hostId → tất cả session ENDED_BY_HOST, meeting FINISHED
4. POST /end với userId != hostId → 403 code 4032
5. POST /approval với action=APPROVED → participant.status=APPROVED, user nhận private STOMP message
6. WebSocket connect, subscribe /topic/meeting/{code} → nhận events khi host kick/mute
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- leaveMeeting + auto-finish + host transfer
- endForAll
- approveParticipant (REST API + STOMP private message)
- WebSocket/STOMP config trong Meeting Service
- Host controls via STOMP MessageMapping
- Waiting room STOMP notifications

❌ KHÔNG làm trong phase này:
- History, Summary, Feedback (Phase 07)
- Kafka publishing (Phase 07)
- gRPC inter-service calls (Phase 10)
- Recording broadcast (Phase 09 sẽ trigger via Media Service)
