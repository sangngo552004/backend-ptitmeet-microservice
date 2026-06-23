# Phase 04 — Meeting Service: Foundation & Basic CRUD

## Mục Tiêu
Xây dựng nền tảng Meeting Service: tất cả entities/repositories, tạo phòng tức thì, lên lịch họp, lấy thông tin phòng, hủy meeting, danh sách meeting. LiveKit token generation.

**Kết quả sau phase này**: Meeting Service chạy ở port 8082, tạo được phòng tức thì và lên lịch, lấy được thông tin phòng.

---

## Tài Liệu Cần Đọc Trước

- `microservices/03-meeting-service.md` — Toàn bộ
- `microservices/07-database-design.md` — Schema Meeting DB
- `microservices/01-architecture.md` — Access Type, Meeting Status
- `microservices/10-api-reference.md` — Request/Response schemas

---

## Cấu Trúc Thư Mục

```
meeting-service/
├── pom.xml
└── src/main/
    ├── java/com/ptitmeet/meeting/
    │   ├── MeetingServiceApplication.java
    │   ├── config/
    │   │   ├── SecurityConfig.java      ← Disable security, đọc X-User-Id từ header
    │   │   ├── LiveKitConfig.java       ← LiveKit SDK config
    │   │   └── KafkaConfig.java         ← Kafka producer config (dùng Phase 07)
    │   ├── entity/
    │   │   ├── Meeting.java
    │   │   ├── Participant.java
    │   │   ├── ParticipantSession.java
    │   │   ├── MeetingInvitation.java
    │   │   ├── MeetingFeedback.java
    │   │   └── OutboxEvent.java
    │   ├── repository/
    │   │   ├── MeetingRepository.java
    │   │   ├── ParticipantRepository.java
    │   │   ├── ParticipantSessionRepository.java
    │   │   ├── MeetingInvitationRepository.java
    │   │   ├── MeetingFeedbackRepository.java
    │   │   └── OutboxEventRepository.java
    │   ├── dto/
    │   │   ├── request/
    │   │   │   └── CreateMeetingRequest.java
    │   │   └── response/
    │   │       ├── MeetingResponse.java
    │   │       └── MeetingInfoResponse.java
    │   ├── mapper/
    │   │   └── MeetingMapper.java
    │   ├── service/
    │   │   ├── MeetingService.java
    │   │   └── LiveKitService.java
    │   ├── controller/
    │   │   └── MeetingController.java
    │   └── util/
    │       └── MeetingCodeGenerator.java
    └── resources/
        └── application.yml
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang xây dựng Meeting Service cho dự án PTITMeet Microservices. Phase này tập trung vào foundation và các endpoint CRUD cơ bản.

**QUAN TRỌNG**: Service này đọc userId từ header "X-User-Id" (được inject bởi API Gateway). KHÔNG validate JWT. KHÔNG có Spring Security filter phức tạp.

### DEPENDENCIES (pom.xml)

```xml
<dependencies>
  <dependency>spring-boot-starter-web</dependency>
  <dependency>spring-boot-starter-validation</dependency>
  <dependency>spring-boot-starter-data-jpa</dependency>
  <dependency>mysql-connector-j (runtime)</dependency>
  <dependency>spring-cloud-starter-netflix-eureka-client</dependency>
  <dependency>spring-boot-starter-websocket</dependency>    <!-- Cho STOMP broadcast -->
  <dependency>spring-kafka</dependency>
  <dependency>io.livekit:livekit-server:0.6.1</dependency>
  <dependency>com.ptitmeet:common:1.0.0-SNAPSHOT</dependency>
  <dependency>lombok</dependency>
  <dependency>mapstruct</dependency>
  <dependency>spring-boot-starter-actuator</dependency>
</dependencies>
```

### CẤU HÌNH (application.yml)

```yaml
server:
  port: 8082

spring:
  application:
    name: meeting-service
  datasource:
    url: jdbc:mysql://${MYSQL_MEETING_HOST:localhost}:${MYSQL_MEETING_PORT:3308}/ptitmeet_meeting_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
    username: root
    password: ${MYSQL_ROOT_PASSWORD:ptitmeet_root_pass}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer

eureka:
  client:
    service-url:
      defaultZone: http://${EUREKA_HOST:localhost}:8761/eureka/
  instance:
    prefer-ip-address: true

livekit:
  host: ${LIVEKIT_HOST:https://your-livekit-server.com}
  api-key: ${LIVEKIT_API_KEY}
  api-secret: ${LIVEKIT_API_SECRET}

# Services URLs (cho Phase 10 gRPC, để placeholder)
services:
  identity-url: ${IDENTITY_SERVICE_URL:http://localhost:8081}
  chat-url: ${CHAT_SERVICE_URL:http://localhost:8083}
  media-url: ${MEDIA_SERVICE_URL:http://localhost:8084}
```

### ENTITIES

#### Meeting.java
```java
@Entity
@Table(name = "meetings")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Meeting {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "meeting_id", columnDefinition = "VARCHAR(36)")
    private String meetingId;

    @Column(name = "host_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String hostId;

    @Column(name = "owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String ownerId;

    @Column(name = "meeting_code", unique = true, nullable = false, length = 20)
    private String meetingCode;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "is_instant", nullable = false)
    @Builder.Default
    private Boolean isInstant = false;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_type", nullable = false)
    @Builder.Default
    private AccessType accessType = AccessType.OPEN;

    @Column(name = "allowed_domain", length = 255)
    private String allowedDomain;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private MeetingStatus status = MeetingStatus.SCHEDULED;

    @Column(name = "settings", columnDefinition = "TEXT")
    private String settings; // JSON string

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum AccessType { OPEN, TRUSTED, RESTRICTED }
    public enum MeetingStatus { SCHEDULED, ACTIVE, FINISHED, CANCELED }
}
```

#### Participant.java
```java
@Entity
@Table(name = "participants",
    uniqueConstraints = @UniqueConstraint(columnNames = {"meeting_id", "user_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Participant {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "participant_id", columnDefinition = "VARCHAR(36)")
    private String participantId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @Column(name = "user_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String userId;   // Raw UUID - NO FK tới identity DB

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    @Builder.Default
    private Role role = Role.GUEST;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false)
    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Role { HOST, GUEST }
    public enum ApprovalStatus { PENDING, APPROVED, REJECTED }
}
```

#### ParticipantSession.java
```java
@Entity
@Table(name = "participant_sessions")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ParticipantSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id", nullable = false)
    private Participant participant;

    @Column(name = "joined_at")
    @CreationTimestamp
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;

    @Column(name = "device_info", columnDefinition = "TEXT")
    private String deviceInfo;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    public enum SessionStatus { ACTIVE, LEFT, KICKED, ENDED_BY_HOST }
}
```

#### MeetingInvitation.java
```java
@Entity
@Table(name = "meeting_invitations")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingInvitation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
    private String userId;  // Raw UUID, nullable

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

#### MeetingFeedback.java
```java
@Entity
@Table(name = "meeting_feedbacks",
    uniqueConstraints = @UniqueConstraint(columnNames = {"meeting_id", "user_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingFeedback {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @Column(name = "user_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String userId;  // Raw UUID

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

#### OutboxEvent.java
```java
@Entity
@Table(name = "outbox_events")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OutboxEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "aggregate_type", nullable = false, length = 50)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String aggregateId;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;  // JSON string

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private OutboxStatus status = OutboxStatus.PENDING;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    public enum OutboxStatus { PENDING, SENT, FAILED }
}
```

### UTIL: MeetingCodeGenerator

Tạo mã phòng dạng "xxx-xxxx-xxx" (lowercase alphanumeric):
```java
@Component
public class MeetingCodeGenerator {
    private static final String CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
    private final SecureRandom random = new SecureRandom();

    public String generate() {
        return randomPart(3) + "-" + randomPart(4) + "-" + randomPart(3);
    }

    private String randomPart(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        return sb.toString();
    }
}
```

Kiểm tra trùng trong DB trước khi lưu, generate lại nếu trùng.

### SERVICE: LiveKitService

```java
@Service
public class LiveKitService {

    @Value("${livekit.host}")
    private String livekitHost;

    @Value("${livekit.api-key}")
    private String apiKey;

    @Value("${livekit.api-secret}")
    private String apiSecret;

    public String generateJoinToken(String roomName, String participantIdentity,
                                     String participantName, boolean isHost) {
        VideoGrants grants = new VideoGrants();
        grants.setRoomJoin(true);
        grants.setRoom(roomName);
        grants.setCanPublish(true);
        grants.setCanSubscribe(true);
        if (isHost) {
            grants.setRoomAdmin(true);  // Host có quyền admin room
        }

        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setName(participantName);
        token.setIdentity(participantIdentity);
        token.setTtl(Duration.ofHours(4));  // Token sống 4 giờ
        token.addGrants(grants);

        return token.toJwt();
    }

    public String getLivekitServerUrl() {
        return livekitHost.replace("https://", "wss://")
                          .replace("http://", "ws://");
    }
}
```

### DTO: CreateMeetingRequest

```java
public class CreateMeetingRequest {
    private String title;

    @JsonProperty("start_time")
    private LocalDateTime startTime;

    @JsonProperty("end_time")
    private LocalDateTime endTime;

    @JsonProperty("access_type")
    @Builder.Default
    private String accessType = "OPEN";  // OPEN, TRUSTED, RESTRICTED

    private String password;
    private String allowedDomain;

    @JsonProperty("participant_emails")
    @Builder.Default
    private List<String> participantEmails = new ArrayList<>();

    private String settings;  // JSON string, nullable
}
```

Default settings JSON nếu null:
```json
{"waitingRoom":true,"muteOnEntry":false,"cameraOffOnEntry":false,"allowChat":true,"allowScreenShare":true}
```

### SERVICE: MeetingService — Implement Các Method Sau

**createInstantMeeting(String userId)**:
1. Tạo meetingCode (unique)
2. Build Meeting entity: hostId=userId, ownerId=userId, isInstant=true, status=ACTIVE, accessType=OPEN, settings=default JSON
3. Save meeting
4. Tạo Participant: userId=userId, role=HOST, approvalStatus=APPROVED, displayName lấy từ header X-User-Name (optional) hoặc "Host"
5. Tạo ParticipantSession: status=ACTIVE
6. Gọi liveKitService.generateJoinToken(meetingCode, userId, displayName, true) → token
7. Return response chứa meeting info + token

**scheduleMeeting(String userId, CreateMeetingRequest req)**:
1. Validate: startTime không được là quá khứ, endTime phải sau startTime
2. Tạo Meeting: status=SCHEDULED, isInstant=false
3. Save meeting
4. Nếu participantEmails không rỗng:
   - Tạo các MeetingInvitation entities
   - Tạo OutboxEvent: aggregateType="MEETING", aggregateId=meetingId, eventType="MEETING_SCHEDULED", payload=JSON chứa title, meetingCode, startTime, endTime, invitedEmails (tất cả trong 1 transaction)
5. Return MeetingResponse

**cancelMeeting(String userId, String meetingCode)**:
1. Tìm meeting theo code → 404 nếu không có
2. Kiểm tra userId == ownerId → 4031 nếu không phải owner
3. Kiểm tra status phải là SCHEDULED → 4093 nếu không
4. Set status = CANCELED, save
5. Return void

**getMyMeetings(String userId)**: Tìm theo ownerId hoặc hostId, trả List<MeetingResponse>

**getMeetingInfo(String userId, String meetingCode)**:
1. Tìm meeting theo code
2. Trả MeetingInfoResponse: meetingCode, title, host_name (TODO: gọi Identity Service Phase 10, hiện tại để "Host"), status, accessType, isPasswordProtected=(password != null)

### CONTROLLER: MeetingController

```java
@RestController
@RequestMapping("/api/meetings")
public class MeetingController {
    // Lấy userId: request.getHeader("X-User-Id")

    @PostMapping("/instant")
    public ResponseEntity<ApiResponse<MeetingResponse>> createInstant(
        HttpServletRequest request,
        @RequestBody(required = false) CreateMeetingRequest req) { ... }

    @PostMapping("/schedule")
    public ResponseEntity<ApiResponse<MeetingResponse>> schedule(
        HttpServletRequest request,
        @Valid @RequestBody CreateMeetingRequest req) { ... }

    @GetMapping("/my-meetings")
    public ResponseEntity<ApiResponse<List<MeetingResponse>>> getMyMeetings(
        HttpServletRequest request) { ... }

    @GetMapping("/{code}/info")
    public ResponseEntity<ApiResponse<MeetingInfoResponse>> getInfo(
        @PathVariable String code,
        HttpServletRequest request) { ... }

    @DeleteMapping("/{code}")
    public ResponseEntity<ApiResponse<Void>> cancel(
        @PathVariable String code,
        HttpServletRequest request) { ... }
}
```

### SECURITY CONFIG (Đơn giản)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
```

### KIỂM TRA KẾT QUẢ

1. POST /api/meetings/instant (header X-User-Id: test-uuid) → MeetingResponse với meetingCode
2. POST /api/meetings/schedule với body hợp lệ → MeetingResponse, status=SCHEDULED
3. POST /api/meetings/schedule với startTime ở quá khứ → 400 validation error
4. DELETE /api/meetings/{code} với userId = ownerId → 200
5. GET /api/meetings/my-meetings → danh sách meeting của user
6. GET /api/meetings/{code}/info → MeetingInfoResponse
7. Kiểm tra DB: bảng meetings, participants, participant_sessions có dữ liệu
8. Kiểm tra Eureka: meeting-service đăng ký thành công
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- Tất cả Entities + Repositories
- MeetingCodeGenerator
- LiveKitService (generateJoinToken)
- createInstantMeeting, scheduleMeeting, cancelMeeting
- getMyMeetings, getMeetingInfo
- OutboxEvent entity (lưu vào DB, chưa publish Kafka)

❌ KHÔNG làm trong phase này:
- joinMeeting flow (Phase 05)
- leaveMeeting, endForAll (Phase 06)
- Approval endpoints (Phase 06)
- History, Summary, Feedback (Phase 07)
- WebSocket/STOMP events (Phase 06)
- Kafka Outbox Worker (Phase 07)
- gRPC calls tới Identity/Chat/Media (Phase 10)
