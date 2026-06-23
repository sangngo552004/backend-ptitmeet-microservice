# Phase 10 — gRPC Integration: Inter-Service Communication

## Mục Tiêu
Thay thế tất cả REST/WebClient inter-service calls bằng gRPC. Định nghĩa proto files, generate stubs, implement gRPC servers và clients cho các call xuyên service.

**Kết quả sau phase này**: Toàn bộ hệ thống hoàn chỉnh, các service giao tiếp với nhau qua gRPC thay vì REST.

---

## Tài Liệu Cần Đọc Trước

- `microservices/08-communication-patterns.md` — Ma trận giao tiếp, gRPC pattern
- `microservices/00-project-overview.md` — Service Discovery với Eureka

---

## Tiền Điều Kiện

Phase 00-09 hoàn thành. Các service đang chạy với REST/WebClient cho inter-service calls (có TODO comments).

---

## Bản Đồ gRPC Calls Cần Implement

| Caller | Callee | Method | Mục đích |
|---|---|---|---|
| Meeting Service | Identity Service | `GetUserInfo(userId)` | Lấy fullName, avatarUrl, email để hiển thị |
| Meeting Service | Identity Service | `GetUsersBatch(userIds)` | Lấy info nhiều users |
| Meeting Service | Chat Service | `GetChatHistory(meetingCode)` | Lấy lịch sử chat cho summary |
| Meeting Service | Chat Service | `GetMessageCount(meetingCode)` | Đếm tin nhắn cho summary |
| Meeting Service | Media Service | `StartRecording(meetingCode, ownerId)` | Bắt đầu ghi hình |
| Meeting Service | Media Service | `StopRecording(egressId)` | Dừng ghi hình |
| Meeting Service | Media Service | `CompensateRecording(egressId)` | Rollback recording |
| Media Service | Meeting Service | `GetMeetingOwner(meetingCode)` | Verify ownerId của meeting |

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang implement gRPC inter-service communication cho PTITMeet Microservices. Đây là phase tích hợp cuối cùng.

**LƯU Ý QUAN TRỌNG**:
- Dùng `net.devh:grpc-spring-boot-starter:2.15.0.RELEASE` (cả server và client)
- gRPC server port: mặc định 9090 (server-side), configure riêng từng service
- Dùng Eureka để resolve địa chỉ gRPC server (hoặc hard-coded trong dev)
- Proto files đặt trong `common/src/main/proto/`

### BƯỚC 1: Cấu Hình Maven cho Proto Generation

Thêm vào `common/pom.xml`:
```xml
<dependencies>
  <dependency>
    <groupId>net.devh</groupId>
    <artifactId>grpc-server-spring-boot-starter</artifactId>
  </dependency>
  <dependency>
    <groupId>net.devh</groupId>
    <artifactId>grpc-client-spring-boot-starter</artifactId>
  </dependency>
  <dependency>
    <groupId>io.grpc</groupId>
    <artifactId>grpc-stub</artifactId>
    <version>1.59.0</version>
  </dependency>
  <dependency>
    <groupId>io.grpc</groupId>
    <artifactId>grpc-protobuf</artifactId>
    <version>1.59.0</version>
  </dependency>
  <dependency>
    <groupId>com.google.protobuf</groupId>
    <artifactId>protobuf-java</artifactId>
    <version>3.24.4</version>
  </dependency>
</dependencies>

<build>
  <extensions>
    <extension>
      <groupId>kr.motd.maven</groupId>
      <artifactId>os-maven-plugin</artifactId>
      <version>1.7.1</version>
    </extension>
  </extensions>
  <plugins>
    <plugin>
      <groupId>org.xolstice.maven.plugins</groupId>
      <artifactId>protobuf-maven-plugin</artifactId>
      <version>0.6.1</version>
      <configuration>
        <protocArtifact>com.google.protobuf:protoc:3.24.4:exe:${os.detected.classifier}</protocArtifact>
        <pluginId>grpc-java</pluginId>
        <pluginArtifact>io.grpc:protoc-gen-grpc-java:1.59.0:exe:${os.detected.classifier}</pluginArtifact>
      </configuration>
      <executions>
        <execution>
          <goals>
            <goal>compile</goal>
            <goal>compile-custom</goal>
          </goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

### BƯỚC 2: Định Nghĩa Proto Files

Tạo tại `common/src/main/proto/`:

#### identity_service.proto
```protobuf
syntax = "proto3";
package ptitmeet.identity;
option java_package = "com.ptitmeet.grpc.identity";
option java_outer_classname = "IdentityServiceProto";

service IdentityGrpcService {
    rpc GetUserById (GetUserRequest) returns (UserInfoResponse);
    rpc GetUsersBatch (GetUsersBatchRequest) returns (UserListResponse);
}

message GetUserRequest {
    string user_id = 1;
}

message GetUsersBatchRequest {
    repeated string user_ids = 1;
}

message UserInfoResponse {
    string user_id = 1;
    string email = 2;
    string full_name = 3;
    string avatar_url = 4;
    string auth_provider = 5;
}

message UserListResponse {
    repeated UserInfoResponse users = 1;
}
```

#### chat_service.proto
```protobuf
syntax = "proto3";
package ptitmeet.chat;
option java_package = "com.ptitmeet.grpc.chat";
option java_outer_classname = "ChatServiceProto";

service ChatGrpcService {
    rpc GetChatHistory (GetChatHistoryRequest) returns (ChatHistoryResponse);
    rpc GetMessageCount (GetMessageCountRequest) returns (MessageCountResponse);
}

message GetChatHistoryRequest {
    string meeting_code = 1;
}

message GetMessageCountRequest {
    string meeting_code = 1;
}

message ChatMessage {
    string id = 1;
    string meeting_code = 2;
    string sender_id = 3;
    string sender_name = 4;
    string content = 5;
    string timestamp = 6;
}

message ChatHistoryResponse {
    repeated ChatMessage messages = 1;
}

message MessageCountResponse {
    int64 count = 1;
}
```

#### media_service.proto
```protobuf
syntax = "proto3";
package ptitmeet.media;
option java_package = "com.ptitmeet.grpc.media";
option java_outer_classname = "MediaServiceProto";

service MediaGrpcService {
    rpc StartRecording (StartRecordingRequest) returns (RecordingResponse);
    rpc StopRecording (StopRecordingRequest) returns (EmptyResponse);
    rpc CompensateRecording (CompensateRequest) returns (EmptyResponse);
}

message StartRecordingRequest {
    string meeting_code = 1;
    string owner_id = 2;
}

message StopRecordingRequest {
    string egress_id = 1;
}

message CompensateRequest {
    string egress_id = 1;
}

message RecordingResponse {
    int64 id = 1;
    string room_name = 2;
    string egress_id = 3;
    string meeting_id = 4;
    string owner_id = 5;
    string status = 6;
    string file_url = 7;
    string created_at = 8;
}

message EmptyResponse {}
```

#### meeting_service.proto
```protobuf
syntax = "proto3";
package ptitmeet.meeting;
option java_package = "com.ptitmeet.grpc.meeting";
option java_outer_classname = "MeetingServiceProto";

service MeetingGrpcService {
    rpc GetMeetingOwner (GetMeetingOwnerRequest) returns (MeetingOwnerResponse);
}

message GetMeetingOwnerRequest {
    string meeting_code = 1;
}

message MeetingOwnerResponse {
    string owner_id = 1;
    string host_id = 2;
    string meeting_id = 3;
    string status = 4;
}
```

### BƯỚC 3: gRPC Server Implementations

#### Identity Service — IdentityGrpcServiceImpl.java
```java
@GrpcService
@RequiredArgsConstructor
public class IdentityGrpcServiceImpl extends IdentityGrpcServiceGrpc.IdentityGrpcServiceImplBase {

    private final UserRepository userRepository;

    @Override
    public void getUserById(GetUserRequest request, StreamObserver<UserInfoResponse> responseObserver) {
        try {
            User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new StatusRuntimeException(
                    Status.NOT_FOUND.withDescription("User not found: " + request.getUserId())));

            responseObserver.onNext(buildUserInfoResponse(user));
            responseObserver.onCompleted();
        } catch (StatusRuntimeException e) {
            responseObserver.onError(e);
        }
    }

    @Override
    public void getUsersBatch(GetUsersBatchRequest request,
                               StreamObserver<UserListResponse> responseObserver) {
        List<User> users = userRepository.findAllById(request.getUserIdsList());
        List<UserInfoResponse> responses = users.stream()
            .map(this::buildUserInfoResponse).toList();
        responseObserver.onNext(UserListResponse.newBuilder().addAllUsers(responses).build());
        responseObserver.onCompleted();
    }

    private UserInfoResponse buildUserInfoResponse(User user) {
        return UserInfoResponse.newBuilder()
            .setUserId(user.getUserId())
            .setEmail(user.getEmail())
            .setFullName(user.getFullName())
            .setAvatarUrl(user.getAvatarUrl() != null ? user.getAvatarUrl() : "")
            .setAuthProvider(user.getAuthProvider().name())
            .build();
    }
}
```

Thêm vào `identity-service/application.yml`:
```yaml
grpc:
  server:
    port: 9081   # Identity gRPC port
```

#### Chat Service — ChatGrpcServiceImpl.java
```java
@GrpcService
@RequiredArgsConstructor
public class ChatGrpcServiceImpl extends ChatGrpcServiceGrpc.ChatGrpcServiceImplBase {

    private final ChatMessageRepository chatMessageRepository;

    @Override
    public void getChatHistory(GetChatHistoryRequest request,
                                StreamObserver<ChatHistoryResponse> responseObserver) {
        List<ChatMessage> messages = chatMessageRepository
            .findByMeetingCodeOrderByTimestampAsc(request.getMeetingCode());

        ChatHistoryResponse.Builder builder = ChatHistoryResponse.newBuilder();
        messages.forEach(m -> builder.addMessages(
            ptitmeet.chat.ChatMessage.newBuilder()
                .setId(m.getId())
                .setMeetingCode(m.getMeetingCode())
                .setSenderId(m.getSenderId())
                .setSenderName(m.getSenderName())
                .setContent(m.getContent())
                .setTimestamp(m.getTimestamp().toString())
                .build()));

        responseObserver.onNext(builder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getMessageCount(GetMessageCountRequest request,
                                 StreamObserver<MessageCountResponse> responseObserver) {
        long count = chatMessageRepository.countByMeetingCode(request.getMeetingCode());
        responseObserver.onNext(MessageCountResponse.newBuilder().setCount(count).build());
        responseObserver.onCompleted();
    }
}
```

Thêm vào `chat-service/application.yml`:
```yaml
grpc:
  server:
    port: 9083
```

#### Media Service — MediaGrpcServiceImpl.java
```java
@GrpcService
@RequiredArgsConstructor
public class MediaGrpcServiceImpl extends MediaGrpcServiceGrpc.MediaGrpcServiceImplBase {

    private final RecordingService recordingService;

    @Override
    public void startRecording(StartRecordingRequest request,
                                StreamObserver<RecordingResponse> responseObserver) {
        try {
            RecordingResponse resp = recordingService.startRecording(
                request.getOwnerId(), request.getMeetingCode());
            // Convert to gRPC response
            responseObserver.onNext(buildRecordingResponse(resp));
            responseObserver.onCompleted();
        } catch (AppException e) {
            responseObserver.onError(Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException());
        }
    }

    // ... StopRecording, CompensateRecording implementations
}
```

```yaml
# media-service/application.yml
grpc:
  server:
    port: 9084
```

#### Meeting Service — MeetingGrpcServiceImpl.java
```java
@GrpcService
@RequiredArgsConstructor
public class MeetingGrpcServiceImpl extends MeetingGrpcServiceGrpc.MeetingGrpcServiceImplBase {

    private final MeetingRepository meetingRepository;

    @Override
    public void getMeetingOwner(GetMeetingOwnerRequest request,
                                 StreamObserver<MeetingOwnerResponse> responseObserver) {
        Meeting meeting = meetingRepository.findByMeetingCode(request.getMeetingCode())
            .orElseThrow(() -> new StatusRuntimeException(
                Status.NOT_FOUND.withDescription("Meeting not found")));

        responseObserver.onNext(MeetingOwnerResponse.newBuilder()
            .setOwnerId(meeting.getOwnerId())
            .setHostId(meeting.getHostId())
            .setMeetingId(meeting.getMeetingId())
            .setStatus(meeting.getStatus().name())
            .build());
        responseObserver.onCompleted();
    }
}
```

```yaml
# meeting-service/application.yml
grpc:
  server:
    port: 9082
```

### BƯỚC 4: gRPC Client Configurations

#### Meeting Service — gRPC Clients

Thêm vào `meeting-service/application.yml`:
```yaml
grpc:
  server:
    port: 9082
  client:
    identity-grpc-client:
      address: static://localhost:9081  # Hoặc dùng Eureka discovery
      negotiation-type: plaintext
    chat-grpc-client:
      address: static://localhost:9083
      negotiation-type: plaintext
    media-grpc-client:
      address: static://localhost:9084
      negotiation-type: plaintext
```

**IdentityGrpcClient.java** (wrapper):
```java
@Service
public class IdentityGrpcClient {

    @GrpcClient("identity-grpc-client")
    private IdentityGrpcServiceGrpc.IdentityGrpcServiceBlockingStub identityStub;

    public UserInfoResponse getUserById(String userId) {
        try {
            return identityStub.getUserById(
                GetUserRequest.newBuilder().setUserId(userId).build());
        } catch (StatusRuntimeException e) {
            if (e.getStatus().getCode() == Status.Code.NOT_FOUND) {
                throw new AppException(ErrorCode.USER_NOT_FOUND);
            }
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public List<UserInfoResponse> getUsersBatch(List<String> userIds) {
        try {
            UserListResponse response = identityStub.getUsersBatch(
                GetUsersBatchRequest.newBuilder().addAllUserIds(userIds).build());
            return response.getUsersList();
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }
}
```

**ChatGrpcClient.java**, **MediaGrpcClient.java**: tương tự pattern trên.

#### Media Service — gRPC Client

```yaml
# media-service/application.yml
grpc:
  server:
    port: 9084
  client:
    meeting-grpc-client:
      address: static://localhost:9082
      negotiation-type: plaintext
```

### BƯỚC 5: Update Business Logic với gRPC Calls

#### Meeting Service — getMeetingInfo() → Thêm host name

Thay `"Host"` placeholder bằng gRPC call:
```java
public MeetingInfoResponse getMeetingInfo(String userId, String meetingCode) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    // Lấy tên host từ Identity Service qua gRPC
    String hostName = "Host";  // Fallback
    try {
        UserInfoResponse userInfo = identityGrpcClient.getUserById(meeting.getHostId());
        hostName = userInfo.getFullName();
    } catch (AppException e) {
        log.warn("Could not fetch host name for meeting {}: {}", meetingCode, e.getMessage());
    }

    return MeetingInfoResponse.builder()
        .meetingCode(meeting.getMeetingCode())
        .title(meeting.getTitle())
        .hostName(hostName)
        .status(meeting.getStatus().name())
        .accessType(meeting.getAccessType().name())
        .isPasswordProtected(meeting.getPassword() != null)
        .build();
}
```

#### Meeting Service — getSummary() → Đếm messages từ Chat Service

```java
// Thay TODO placeholder:
int messageCount = 0;
try {
    MessageCountResponse countResponse = chatGrpcClient.getMessageCount(meetingCode);
    messageCount = (int) countResponse.getCount();
} catch (AppException e) {
    log.warn("Could not fetch message count: {}", e.getMessage());
}
```

#### Meeting Service — getChatHistory() → Lấy từ Chat Service

```java
public List<ChatMessageResponse> getChatHistory(String userId, String meetingCode) {
    // ... (access check giữ nguyên)

    try {
        ChatHistoryResponse historyResponse = chatGrpcClient.getChatHistory(meetingCode);
        return historyResponse.getMessagesList().stream()
            .map(m -> ChatMessageResponse.builder()
                .id(m.getId())
                .meetingCode(m.getMeetingCode())
                .senderId(m.getSenderId())
                .senderName(m.getSenderName())
                .content(m.getContent())
                .timestamp(LocalDateTime.parse(m.getTimestamp()))
                .build())
            .toList();
    } catch (AppException e) {
        log.warn("Could not fetch chat history: {}", e.getMessage());
        return Collections.emptyList();
    }
}
```

#### Meeting Service — startRecording() → Gọi Media Service qua gRPC

```java
public void startRecording(String userId, String meetingCode) {
    Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
        .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

    if (!userId.equals(meeting.getOwnerId())) {
        throw new AppException(ErrorCode.ONLY_OWNER);
    }

    RecordingResponse recordingResponse;
    try {
        // Gọi Media Service qua gRPC
        recordingResponse = mediaGrpcClient.startRecording(meetingCode, userId);
    } catch (AppException e) {
        throw e;  // Re-throw: RECORDING_ALREADY_RUNNING hoặc LIVEKIT_ERROR
    }

    // Broadcast STOMP event
    messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
        SystemEvent.builder()
            .action("RECORDING_STARTED")
            .egressId(recordingResponse.getEgressId())
            .build());
}
```

Thêm endpoints:
```java
@PostMapping("/{code}/recording/start")
public ResponseEntity<ApiResponse<Void>> startRecording(
    @PathVariable String code, HttpServletRequest req) {
    meetingService.startRecording(req.getHeader("X-User-Id"), code);
    return ResponseEntity.ok(ApiResponse.success(null));
}

@PostMapping("/{code}/recording/stop")
public ResponseEntity<ApiResponse<Void>> stopRecording(
    @PathVariable String code,
    @RequestParam String egressId,
    HttpServletRequest req) {
    meetingService.stopRecording(req.getHeader("X-User-Id"), code, egressId);
    return ResponseEntity.ok(ApiResponse.success(null));
}
```

#### Media Service — Verify ownerId qua gRPC

Cập nhật `startRecording()` trong Media Service:
```java
public RecordingResponse startRecording(String callerUserId, String meetingCode) {
    // Verify caller là owner thực sự của meeting
    MeetingOwnerResponse ownerInfo = meetingGrpcClient.getMeetingOwner(meetingCode);
    if (!callerUserId.equals(ownerInfo.getOwnerId())) {
        throw new AppException(ErrorCode.ONLY_OWNER);
    }
    // ... rest of logic
}
```

### BƯỚC 6: Xóa REST Clients Cũ

- Xóa WebClient trong Media Service (thay bằng gRPC)
- Xóa webflux dependency nếu không dùng nơi khác
- Xóa TODO comments đã được implement

### BƯỚC 7: Update Docker Compose — Expose gRPC Ports

```yaml
# Thêm vào docker-compose.yml
identity-service:
  ports:
    - "8081:8081"
    - "9081:9081"  # gRPC port

meeting-service:
  ports:
    - "8082:8082"
    - "9082:9082"

chat-service:
  ports:
    - "8083:8083"
    - "9083:9083"

media-service:
  ports:
    - "8084:8084"
    - "9084:9084"
```

### KIỂM TRA KẾT QUẢ

1. Chạy `mvn clean install -pl common` → generate stubs thành công
2. GET /api/meetings/{code}/info → trả `hostName` thực từ Identity Service (qua gRPC)
3. GET /api/meetings/{code}/summary → `messages` đúng số lượng (từ Chat Service gRPC)
4. GET /api/meetings/{code}/chat/history → trả chat messages từ Chat Service
5. POST /api/meetings/{code}/recording/start → Media Service verify ownerId qua gRPC, bắt đầu recording
6. POST /api/meetings/{code}/recording/start với user không phải owner → 403 code 4031
7. gRPC health: `grpcurl -plaintext localhost:9081 list` → hiện services

### XỬ LÝ LỖI gRPC

Mỗi gRPC call cần try-catch `StatusRuntimeException`:
```java
try {
    // gRPC call
} catch (StatusRuntimeException e) {
    Status.Code code = e.getStatus().getCode();
    if (code == Status.Code.NOT_FOUND) throw new AppException(ErrorCode.USER_NOT_FOUND);
    if (code == Status.Code.UNAVAILABLE) throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
    if (code == Status.Code.PERMISSION_DENIED) throw new AppException(ErrorCode.FORBIDDEN);
    throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
}
```
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- Proto file definitions (4 proto files)
- Maven protobuf generation setup
- gRPC server implementations (Identity, Chat, Media, Meeting)
- gRPC client wrappers (Meeting → Identity, Chat, Media; Media → Meeting)
- Update business logic với gRPC calls thay thế TODO
- Remove REST/WebClient inter-service code

❌ KHÔNG làm trong phase này (scope tương lai):
- Kafka Consumer / Notification Service
- Redis Pub/Sub WebSocket scale
- Circuit breaker (Resilience4j)
- TLS/mTLS cho gRPC
- gRPC load balancing với Eureka native support
