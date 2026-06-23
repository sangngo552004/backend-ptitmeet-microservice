# Phase 09 — Media Service

## Mục Tiêu
Xây dựng Media Service hoàn chỉnh: start/stop recording qua LiveKit Egress, nhận webhook callback từ LiveKit, lưu metadata vào MySQL, verify ownership (tạm thời qua REST, Phase 10 sẽ đổi sang gRPC), compensating transaction endpoint.

**Kết quả sau phase này**: Media Service chạy ở port 8084, recording bắt đầu/dừng được, webhook cập nhật đúng trạng thái và file URL.

---

## Tài Liệu Cần Đọc Trước

- `microservices/05-media-service.md` — Toàn bộ
- `microservices/07-database-design.md` — Schema bảng meeting_recordings
- `microservices/10-api-reference.md` — Media Service endpoints

---

## Cấu Trúc Thư Mục

```
media-service/
├── pom.xml
└── src/main/
    ├── java/com/ptitmeet/media/
    │   ├── MediaServiceApplication.java
    │   ├── config/
    │   │   ├── SecurityConfig.java
    │   │   ├── LiveKitConfig.java
    │   │   └── S3Config.java
    │   ├── entity/
    │   │   └── MeetingRecording.java
    │   ├── repository/
    │   │   └── MeetingRecordingRepository.java
    │   ├── dto/
    │   │   ├── request/
    │   │   │   └── (none — dùng query params)
    │   │   └── response/
    │   │       └── RecordingResponse.java
    │   ├── service/
    │   │   ├── RecordingService.java
    │   │   └── LiveKitWebhookService.java
    │   └── controller/
    │       ├── RecordingController.java
    │       └── LiveKitWebhookController.java
    └── resources/
        └── application.yml
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang xây dựng Media Service. Service này tương tác trực tiếp với LiveKit Egress API để quản lý recording và nhận callback từ LiveKit server.

### DEPENDENCIES (pom.xml)

```xml
<dependencies>
  <dependency>spring-boot-starter-web</dependency>
  <dependency>spring-boot-starter-data-jpa</dependency>
  <dependency>mysql-connector-j (runtime)</dependency>
  <dependency>spring-cloud-starter-netflix-eureka-client</dependency>
  <dependency>io.livekit:livekit-server:0.6.1</dependency>
  <dependency>software.amazon.awssdk:s3:2.21.x</dependency>
  <dependency>com.ptitmeet:common:1.0.0-SNAPSHOT</dependency>
  <dependency>lombok</dependency>
  <dependency>spring-boot-starter-actuator</dependency>

  <!-- HTTP client cho REST call tới Meeting Service (tạm thời, Phase 10 đổi gRPC) -->
  <dependency>org.springframework.boot:spring-boot-starter-webflux</dependency>
</dependencies>
```

### CẤU HÌNH (application.yml)

```yaml
server:
  port: 8084

spring:
  application:
    name: media-service
  datasource:
    url: jdbc:mysql://${MYSQL_MEDIA_HOST:localhost}:${MYSQL_MEDIA_PORT:3309}/ptitmeet_media_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
    username: root
    password: ${MYSQL_ROOT_PASSWORD:ptitmeet_root_pass}
  jpa:
    hibernate:
      ddl-auto: update

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
  webhook-secret: ${LIVEKIT_WEBHOOK_SECRET}

aws:
  s3:
    bucket: ${AWS_S3_BUCKET:ptitmeet-recordings}
    region: ${AWS_S3_REGION:ap-southeast-1}
    access-key: ${AWS_ACCESS_KEY_ID}
    secret-key: ${AWS_SECRET_ACCESS_KEY}

services:
  meeting-url: ${MEETING_SERVICE_URL:http://localhost:8082}
```

### ENTITY: MeetingRecording.java

```java
@Entity
@Table(name = "meeting_recordings")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingRecording {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_name", nullable = false, length = 100)
    private String roomName;          // = meeting_code

    @Column(name = "egress_id", unique = true, nullable = false)
    private String egressId;

    @Column(name = "meeting_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String meetingId;         // Raw UUID — NO FK

    @Column(name = "owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String ownerId;           // Raw UUID — NO FK

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private RecordingStatus status = RecordingStatus.RECORDING;

    @Column(name = "file_url", columnDefinition = "TEXT")
    private String fileUrl;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public enum RecordingStatus { RECORDING, COMPLETED, FAILED }
}
```

### REPOSITORY: MeetingRecordingRepository.java

```java
public interface MeetingRecordingRepository extends JpaRepository<MeetingRecording, Long> {
    Optional<MeetingRecording> findByEgressId(String egressId);
    List<MeetingRecording> findByOwnerIdOrderByCreatedAtDesc(String ownerId);
    Optional<MeetingRecording> findByRoomNameAndStatus(
        String roomName, MeetingRecording.RecordingStatus status);
}
```

### SERVICE: RecordingService.java

**Inject MeetingServiceClient** (WebClient để gọi Meeting Service REST tạm thời):
```java
@Value("${services.meeting-url}")
private String meetingServiceUrl;

private final WebClient.Builder webClientBuilder;

// Helper method
private String getMeetingOwnerId(String meetingCode) {
    // Gọi GET {meetingUrl}/api/meetings/{code}/info
    // Parse response, lấy hostId hoặc ownerId
    // Tạm thời: return từ query param hoặc header X-User-Id (vì owner đã được verify ở Meeting Service)
    // Phase 10: đổi thành gRPC call
    // Hiện tại: Return null → Meeting Service trực tiếp gọi API với X-User-Id đã được inject
}
```

**LƯU Ý THIẾT KẾ**: Trong Phase này, việc verify "userId có phải ownerId của meeting không" sẽ được thực hiện đơn giản: Meeting Service khi gọi `/api/livekit/recordings/start` sẽ truyền `X-User-Id` header, và Media Service tin tưởng rằng Meeting Service đã verify quyền trước đó. Việc verify 2 lần (double verification) sẽ được bổ sung ở Phase 10 qua gRPC.

**startRecording(String ownerIdFromHeader, String meetingCode)**:
```java
@Transactional
public RecordingResponse startRecording(String ownerId, String meetingCode) {
    // 1. Kiểm tra đã có recording RUNNING không
    meetingRecordingRepository
        .findByRoomNameAndStatus(meetingCode, RecordingStatus.RECORDING)
        .ifPresent(r -> { throw new AppException(ErrorCode.RECORDING_ALREADY_RUNNING); });

    // 2. Tạo S3 config cho LiveKit Egress
    String objectKey = meetingCode + "/" + System.currentTimeMillis() + ".mp4";

    EgressInfo egressInfo;
    try {
        RoomServiceClient roomClient = new RoomServiceClient(
            livekitHost, livekitApiKey, livekitApiSecret);

        egressInfo = roomClient.startRoomCompositeEgress(
            meetingCode,
            "", // Layout - để trống dùng default
            EncodedFileOutput.newBuilder()
                .setFileType(EncodedFileType.MP4)
                .setFilepath(objectKey)
                .setS3(S3Upload.newBuilder()
                    .setAccessKey(s3AccessKey)
                    .setSecret(s3SecretKey)
                    .setBucket(s3Bucket)
                    .setRegion(s3Region)
                    .build())
                .build()
        ).get();
    } catch (Exception e) {
        log.error("LiveKit Egress error: {}", e.getMessage());
        throw new AppException(ErrorCode.LIVEKIT_ERROR);
    }

    // 3. Lưu metadata vào DB
    // meetingId: Media Service không có meetingId ở đây (chỉ có meetingCode)
    // Giải pháp: lưu meetingCode làm roomName, meetingId để trống hoặc dùng meetingCode
    MeetingRecording recording = MeetingRecording.builder()
        .roomName(meetingCode)
        .egressId(egressInfo.getEgressId())
        .meetingId(meetingCode)  // Tạm dùng meetingCode, Phase 10 sẽ cải thiện
        .ownerId(ownerId)
        .status(RecordingStatus.RECORDING)
        .build();

    recording = meetingRecordingRepository.save(recording);
    return toResponse(recording);
}
```

**stopRecording(String egressId)**:
```java
public void stopRecording(String egressId) {
    MeetingRecording recording = meetingRecordingRepository
        .findByEgressId(egressId)
        .orElseThrow(() -> new AppException(ErrorCode.RECORDING_NOT_FOUND));

    try {
        RoomServiceClient roomClient = new RoomServiceClient(
            livekitHost, livekitApiKey, livekitApiSecret);
        roomClient.stopEgress(egressId).get();
    } catch (Exception e) {
        log.error("Error stopping egress {}: {}", egressId, e.getMessage());
        throw new AppException(ErrorCode.LIVEKIT_ERROR);
    }
    // Status sẽ được cập nhật khi nhận webhook từ LiveKit
}
```

**getMyRecordings(String ownerId)**:
```java
public List<RecordingResponse> getMyRecordings(String ownerId) {
    return meetingRecordingRepository
        .findByOwnerIdOrderByCreatedAtDesc(ownerId)
        .stream().map(this::toResponse).toList();
}
```

**compensateRecording(String egressId)** — Compensating transaction:
```java
@Transactional
public void compensateRecording(String egressId) {
    MeetingRecording recording = meetingRecordingRepository
        .findByEgressId(egressId)
        .orElse(null);

    if (recording == null) return;  // Idempotent: không tìm thấy thì bỏ qua

    // Nếu còn RECORDING, stop egress trước
    if (recording.getStatus() == RecordingStatus.RECORDING) {
        try {
            RoomServiceClient roomClient = new RoomServiceClient(
                livekitHost, livekitApiKey, livekitApiSecret);
            roomClient.stopEgress(egressId).get();
        } catch (Exception ignored) {
            // Best effort, không throw exception
        }
    }

    meetingRecordingRepository.delete(recording);
}
```

### SERVICE: LiveKitWebhookService.java

**Xác thực webhook từ LiveKit**:
LiveKit ký request bằng HMAC. Dùng `WebhookReceiver` từ LiveKit SDK:

```java
@Service
public class LiveKitWebhookService {

    @Value("${livekit.api-key}")
    private String apiKey;

    @Value("${livekit.api-secret}")
    private String apiSecret;

    private final MeetingRecordingRepository recordingRepository;

    public String processWebhook(String body, String authHeader) {
        try {
            WebhookReceiver receiver = new WebhookReceiver(apiKey, apiSecret);
            WebhookEvent event = receiver.receive(body, authHeader);

            log.info("LiveKit webhook: event={}", event.getEvent());

            if ("egress_ended".equals(event.getEvent())) {
                handleEgressEnded(event.getEgressInfo());
            }

            return "OK";

        } catch (Exception e) {
            log.error("Webhook processing failed: {}", e.getMessage());
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    private void handleEgressEnded(EgressInfo egressInfo) {
        if (egressInfo == null) return;

        String egressId = egressInfo.getEgressId();
        MeetingRecording recording = recordingRepository
            .findByEgressId(egressId)
            .orElse(null);

        if (recording == null) {
            log.warn("Received webhook for unknown egressId: {}", egressId);
            return;
        }

        // Update status based on egress status
        if (egressInfo.getStatus() == EgressStatus.EGRESS_COMPLETE) {
            // Lấy file URL từ S3 output
            String fileUrl = extractFileUrl(egressInfo);
            recording.setStatus(RecordingStatus.COMPLETED);
            recording.setFileUrl(fileUrl);
            recording.setCompletedAt(LocalDateTime.now());
        } else if (egressInfo.getStatus() == EgressStatus.EGRESS_FAILED) {
            recording.setStatus(RecordingStatus.FAILED);
            recording.setCompletedAt(LocalDateTime.now());
            log.error("Egress {} failed: {}", egressId, egressInfo.getError());
        }

        recordingRepository.save(recording);
    }

    private String extractFileUrl(EgressInfo egressInfo) {
        // Lấy URL từ S3 output file
        // EgressInfo có field file_results, parse lấy S3 URL
        try {
            if (!egressInfo.getFileResultsList().isEmpty()) {
                var fileResult = egressInfo.getFileResults(0);
                // Construct S3 URL: https://{bucket}.s3.{region}.amazonaws.com/{filename}
                String location = fileResult.getLocation();
                return location;  // LiveKit trả về s3:// hoặc https:// URL
            }
        } catch (Exception e) {
            log.error("Error extracting file URL: {}", e.getMessage());
        }
        return null;
    }
}
```

### CONTROLLER: RecordingController.java

```java
@RestController
@RequestMapping("/api/livekit")
@RequiredArgsConstructor
public class RecordingController {

    private final RecordingService recordingService;

    @PostMapping("/recordings/start")
    public ResponseEntity<ApiResponse<RecordingResponse>> startRecording(
        @RequestParam String meetingCode,
        HttpServletRequest request) {
        String ownerId = request.getHeader("X-User-Id");
        return ResponseEntity.ok(ApiResponse.success(
            recordingService.startRecording(ownerId, meetingCode)));
    }

    @PostMapping("/recordings/stop")
    public ResponseEntity<ApiResponse<Void>> stopRecording(
        @RequestParam String egressId) {
        recordingService.stopRecording(egressId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/recordings/my")
    public ResponseEntity<ApiResponse<List<RecordingResponse>>> getMyRecordings(
        HttpServletRequest request) {
        String ownerId = request.getHeader("X-User-Id");
        return ResponseEntity.ok(ApiResponse.success(
            recordingService.getMyRecordings(ownerId)));
    }

    // Compensating transaction endpoint (internal call from Meeting Service)
    @DeleteMapping("/recordings/{egressId}")
    public ResponseEntity<ApiResponse<Void>> compensate(
        @PathVariable String egressId) {
        recordingService.compensateRecording(egressId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
```

### CONTROLLER: LiveKitWebhookController.java

```java
@RestController
@RequiredArgsConstructor
public class LiveKitWebhookController {

    private final LiveKitWebhookService webhookService;

    // KHÔNG có JWT (LiveKit dùng webhook secret riêng)
    @PostMapping("/api/livekit/webhook")
    public ResponseEntity<String> handleWebhook(
        @RequestBody String body,
        @RequestHeader("Authorization") String authHeader) {
        String result = webhookService.processWebhook(body, authHeader);
        return ResponseEntity.ok(result);
    }
}
```

### LƯU Ý VỀ LIVEKIT SDK

LiveKit Java SDK (io.livekit:livekit-server) sử dụng gRPC-based protocol.
- Import: `import io.livekit.server.*`
- Tất cả calls trả về `CompletableFuture` → cần `.get()` hoặc `.join()`
- Verify: kiểm tra version 0.6.1 có class `RoomServiceClient` và `WebhookReceiver`

Nếu SDK version mới hơn có breaking changes, refer tới LiveKit Java SDK docs.

### LIÊN KẾT VỚI MEETING SERVICE

Khi Meeting Service gọi start recording:
1. Meeting Service POST /api/livekit/recordings/start?meetingCode=xxx với header X-User-Id
2. Media Service verify: userId là owner không → tạm thời SKIP (Phase 10 gRPC)
3. Nếu recording thành công, Meeting Service broadcast RECORDING_STARTED qua STOMP
4. Nếu Media Service fail → Meeting Service catch exception, không cần compensate (chưa có gì để compensate)
5. Nếu Meeting Service fail SAU KHI Media Service succeed → Meeting Service gọi DELETE /api/livekit/recordings/{egressId}

### KIỂM TRA KẾT QUẢ

1. POST /api/livekit/recordings/start?meetingCode=test-room (header X-User-Id: uuid)
   → Nếu LiveKit server configured: EgressInfo được trả về, recording lưu DB với status=RECORDING
   → Nếu LiveKit chưa config: AppException LIVEKIT_ERROR
2. POST /api/livekit/recordings/stop?egressId=xxx → 200 (LiveKit stop egress async)
3. POST /api/livekit/webhook với payload EGRESS_ENDED → DB updated status=COMPLETED/FAILED
4. GET /api/livekit/recordings/my → list recordings của owner
5. DELETE /api/livekit/recordings/{egressId} → recording bị xóa (compensating)
6. Kiểm tra Eureka: media-service đăng ký thành công
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- MeetingRecording entity + repository
- startRecording (LiveKit Egress API call)
- stopRecording
- LiveKit webhook handler (EGRESS_ENDED)
- getMyRecordings
- compensateRecording (DELETE endpoint)

❌ KHÔNG làm trong phase này:
- Verify ownerId qua gRPC (Phase 10)
- Broadcast RECORDING_STARTED/STOPPED qua STOMP (Phase 10 — Meeting Service sẽ làm)
- gRPC server (Phase 10)
