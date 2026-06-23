# Phase 07 — Meeting Service: History, Summary, Feedback, Settings & Kafka Outbox

## Mục Tiêu
Hoàn thiện Meeting Service với: lịch sử họp (có phân trang + filter), tóm tắt sau họp, đánh giá, cài đặt phòng, meeting up-next, và Kafka Outbox Worker để gửi event thông báo.

**Kết quả sau phase này**: Meeting Service hoàn chỉnh 100%.

---

## Tài Liệu Cần Đọc Trước

- `microservices/03-meeting-service.md` — Section 7 (API Endpoints), Section 8 (Business Rules)
- `microservices/08-communication-patterns.md` — Transactional Outbox Pattern, Kafka
- `microservices/10-api-reference.md` — MeetingHistoryResponse, MeetingSummaryResponse schemas

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang hoàn thiện phần cuối của Meeting Service.

### BƯỚC 1: Meeting History (Có phân trang + Filter)

**DTO MeetingHistoryResponse.java**:
```java
@Data @Builder
public class MeetingHistoryResponse {
    private String meetingCode;
    private String title;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String status;
    private boolean isHost;
    private boolean isOwner;
    private boolean canViewRecordings;
    private boolean canViewChatHistory;
}
```

**Repository Query** (MeetingRepository):
```java
// Lấy danh sách meeting mà user đã tham gia (có participant record)
@Query("""
    SELECT DISTINCT m FROM Meeting m
    JOIN m.participants p
    WHERE p.userId = :userId
    AND (:status = 'ALL' OR m.status = :statusEnum)
    ORDER BY m.createdAt DESC
    """)
Page<Meeting> findMeetingHistoryByUserId(
    @Param("userId") String userId,
    @Param("status") String status,
    @Param("statusEnum") Meeting.MeetingStatus statusEnum,
    Pageable pageable);
```

**Cách xử lý filter `role`**:
- `role=ALL` → lấy tất cả meeting user tham gia
- `role=HOST` → chỉ meeting mà userId == ownerId hoặc userId == hostId
- `role=GUEST` → chỉ meeting mà userId != ownerId

Có thể implement bằng 2 query riêng hoặc dùng Specification.

**Logic service getHistory()**:
```java
public Page<MeetingHistoryResponse> getHistory(
    String userId, int page, int size, String role, String status) {

    Pageable pageable = PageRequest.of(page - 1, size);
    Page<Meeting> meetings = findMeetingsForHistory(userId, role, status, pageable);

    return meetings.map(meeting -> {
        boolean isOwner = userId.equals(meeting.getOwnerId());
        boolean isHost = userId.equals(meeting.getHostId()) || isOwner;
        return MeetingHistoryResponse.builder()
            .meetingCode(meeting.getMeetingCode())
            .title(meeting.getTitle())
            .startTime(meeting.getStartTime())
            .endTime(meeting.getEndTime())
            .status(meeting.getStatus().name())
            .isHost(isHost)
            .isOwner(isOwner)
            .canViewRecordings(isOwner)
            .canViewChatHistory(isOwner)  // TODO: hoặc active participant
            .build();
    });
}
```

**Endpoint**: GET /api/meetings/history?page=1&size=6&role=ALL&status=ALL

### BƯỚC 2: Up-Next

Tìm meeting sắp tới gần nhất của user (chưa qua, status=SCHEDULED):
```java
public MeetingHistoryResponse getUpNext(String userId) {
    // Tìm meeting SCHEDULED mà user là owner, startTime > now, gần nhất
    return meetingRepository
        .findFirstByOwnerIdAndStatusAndStartTimeAfterOrderByStartTimeAsc(
            userId, MeetingStatus.SCHEDULED, LocalDateTime.now())
        .map(m -> toHistoryResponse(m, userId))
        .orElse(null);
}
```

**Endpoint**: GET /api/meetings/up-next

### BƯỚC 3: Meeting Summary

**DTO MeetingSummaryResponse.java**:
```java
@Data @Builder
public class MeetingSummaryResponse {
    private String duration;       // VD: "1h 30m" hoặc "45m"
    private Integer participants;  // Số người tham gia (distinct)
    private Integer messages;      // TODO: gọi Chat Service (Phase 10), hiện tại để 0
}
```

**Logic getSummary()**:
```java
public MeetingSummaryResponse getSummary(String userId, String meetingCode, String action) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    // Tính duration từ startTime → endTime (hoặc now nếu chưa kết thúc)
    LocalDateTime end = meeting.getEndTime() != null ? meeting.getEndTime() : LocalDateTime.now();
    LocalDateTime start = meeting.getStartTime() != null ? meeting.getStartTime() : meeting.getCreatedAt();
    Duration duration = Duration.between(start, end);
    String durationStr = formatDuration(duration);

    // Đếm số participants distinct
    long participantCount = participantRepository
        .countDistinctUserIdByMeeting(meeting);

    // Messages: TODO gọi Chat Service gRPC (Phase 10), tạm để 0
    int messageCount = 0;
    // TODO Phase 10: messageCount = chatServiceClient.getMessageCount(meetingCode);

    return MeetingSummaryResponse.builder()
        .duration(durationStr)
        .participants((int) participantCount)
        .messages(messageCount)
        .build();
}

private String formatDuration(Duration d) {
    long hours = d.toHours();
    long minutes = d.toMinutesPart();
    if (hours > 0) return hours + "h " + minutes + "m";
    return minutes + "m";
}
```

**Repository**:
```java
@Query("SELECT COUNT(DISTINCT p.userId) FROM Participant p WHERE p.meeting = :meeting")
long countDistinctUserIdByMeeting(@Param("meeting") Meeting meeting);
```

**Endpoint**: GET /api/meetings/{code}/summary?action=LEAVE

### BƯỚC 4: Chat History Proxy

Meeting Service forward request tới Chat Service:
```java
public List<ChatMessageResponse> getChatHistory(String userId, String meetingCode) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    // Chỉ owner hoặc participant đang active
    boolean isOwner = userId.equals(meeting.getOwnerId());
    boolean isActiveParticipant = participantSessionRepository
        .existsByParticipant_Meeting_MeetingCodeAndParticipant_UserIdAndStatus(
            meetingCode, userId, SessionStatus.ACTIVE);

    if (!isOwner && !isActiveParticipant) {
        throw new AppException(ErrorCode.FORBIDDEN);
    }

    // TODO Phase 10: return chatServiceClient.getChatHistory(meetingCode);
    // Tạm thời trả empty list
    return Collections.emptyList();
}
```

**Endpoint**: GET /api/meetings/{code}/chat/history

### BƯỚC 5: Feedback

```java
@Transactional
public void submitFeedback(String userId, String meetingCode, FeedbackRequest req) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    if (meetingFeedbackRepository.existsByMeetingAndUserId(meeting, userId)) {
        throw new AppException(ErrorCode.FEEDBACK_ALREADY_SUBMITTED);
    }

    if (req.getRating() < 1 || req.getRating() > 5) {
        throw new AppException(ErrorCode.VALIDATION_FAILED);
    }

    MeetingFeedback feedback = MeetingFeedback.builder()
        .meeting(meeting)
        .userId(userId)
        .rating(req.getRating())
        .build();
    meetingFeedbackRepository.save(feedback);
}
```

**DTO FeedbackRequest**: `rating` (NotNull, Min=1, Max=5)

**Endpoint**: POST /api/meetings/{code}/feedback

### BƯỚC 6: Settings Endpoints

```java
public String getSettings(String userId, String meetingCode) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
    return meeting.getSettings();
}

@Transactional
public MeetingResponse updateSettings(String userId, String meetingCode,
                                       Map<String, Object> newSettings) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    if (!userId.equals(meeting.getOwnerId())) {
        throw new AppException(ErrorCode.ONLY_OWNER);
    }

    try {
        String settingsJson = objectMapper.writeValueAsString(newSettings);
        meeting.setSettings(settingsJson);
        return meetingMapper.toResponse(meetingRepository.save(meeting));
    } catch (JsonProcessingException e) {
        throw new AppException(ErrorCode.VALIDATION_FAILED);
    }
}
```

**Endpoints**:
- GET /api/meetings/{code}/settings
- PUT /api/meetings/{code}/settings (body: JSON object)

### BƯỚC 7: Kafka Outbox Worker

**OutboxWorker.java** — Polling scheduler:
```java
@Component
@RequiredArgsConstructor
public class OutboxWorker {

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelay = 5000)  // Chạy mỗi 5 giây
    @Transactional
    public void processOutboxEvents() {
        List<OutboxEvent> pendingEvents = outboxEventRepository
            .findTop20ByStatusOrderByCreatedAtAsc(OutboxEvent.OutboxStatus.PENDING);

        for (OutboxEvent event : pendingEvents) {
            try {
                kafkaTemplate.send("meeting-events", event.getAggregateId(), event.getPayload());
                event.setStatus(OutboxEvent.OutboxStatus.SENT);
                event.setProcessedAt(LocalDateTime.now());
            } catch (Exception e) {
                log.error("Failed to publish outbox event {}: {}", event.getId(), e.getMessage());
                event.setStatus(OutboxEvent.OutboxStatus.FAILED);
            }
            outboxEventRepository.save(event);
        }
    }
}
```

**Thêm annotation vào Application class**:
```java
@SpringBootApplication
@EnableScheduling  // Bật @Scheduled
public class MeetingServiceApplication { ... }
```

**Kafka Config**:
```java
@Configuration
public class KafkaConfig {
    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate(
        ProducerFactory<String, Object> factory) {
        return new KafkaTemplate<>(factory);
    }
}
```

**Kafka application.yml** (đã có từ Phase 04, verify):
```yaml
spring:
  kafka:
    producer:
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      properties:
        spring.json.add.type.headers: false
```

**Repository**:
```java
List<OutboxEvent> findTop20ByStatusOrderByCreatedAtAsc(OutboxEvent.OutboxStatus status);
```

### BƯỚC 8: Controller — Thêm Các Endpoints Còn Lại

```java
@GetMapping("/history")
public ResponseEntity<ApiResponse<Page<MeetingHistoryResponse>>> getHistory(
    @RequestParam(defaultValue = "1") int page,
    @RequestParam(defaultValue = "6") int size,
    @RequestParam(defaultValue = "ALL") String role,
    @RequestParam(defaultValue = "ALL") String status,
    HttpServletRequest req) { ... }

@GetMapping("/up-next")
public ResponseEntity<ApiResponse<MeetingHistoryResponse>> getUpNext(HttpServletRequest req) { ... }

@GetMapping("/{code}/summary")
public ResponseEntity<ApiResponse<MeetingSummaryResponse>> getSummary(
    @PathVariable String code,
    @RequestParam(defaultValue = "LEAVE") String action,
    HttpServletRequest req) { ... }

@GetMapping("/{code}/chat/history")
public ResponseEntity<ApiResponse<List<?>>> getChatHistory(
    @PathVariable String code, HttpServletRequest req) { ... }

@PostMapping("/{code}/feedback")
public ResponseEntity<ApiResponse<Void>> feedback(
    @PathVariable String code,
    @Valid @RequestBody FeedbackRequest req,
    HttpServletRequest request) { ... }

@GetMapping("/{code}/settings")
public ResponseEntity<ApiResponse<String>> getSettings(
    @PathVariable String code, HttpServletRequest req) { ... }

@PutMapping("/{code}/settings")
public ResponseEntity<ApiResponse<MeetingResponse>> updateSettings(
    @PathVariable String code,
    @RequestBody Map<String, Object> settings,
    HttpServletRequest req) { ... }
```

### KIỂM TRA KẾT QUẢ

1. GET /history?page=1&size=6 → danh sách meetings có phân trang
2. GET /history?role=HOST → chỉ meetings là host
3. GET /up-next → meeting SCHEDULED gần nhất
4. GET /{code}/summary → duration, participants count
5. POST /{code}/feedback với rating=5 → 200, lần 2 → 409 code 4092
6. GET /{code}/settings → JSON string
7. PUT /{code}/settings với body {"waitingRoom": false} → cập nhật settings
8. Kafka: sau khi schedule meeting, bảng outbox_events có record PENDING → sau 5s chuyển SENT
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- History với phân trang + filter role/status
- Up-next
- Summary (message count để TODO cho Phase 10)
- Chat history proxy (để TODO cho Phase 10)
- Feedback
- Settings CRUD
- Kafka Outbox Worker

❌ KHÔNG làm trong phase này:
- Kafka Consumer (Notification Service)
- gRPC calls (Phase 10)
- Bất kỳ service nào khác
