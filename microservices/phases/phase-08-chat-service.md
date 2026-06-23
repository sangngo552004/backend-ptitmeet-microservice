# Phase 08 — Chat Service

## Mục Tiêu
Xây dựng Chat Service hoàn chỉnh: WebSocket/STOMP broker, lưu trữ tin nhắn vào MongoDB, broadcast real-time, REST API cho lịch sử chat và đếm tin nhắn.

**Kết quả sau phase này**: Chat Service chạy ở port 8083, client có thể gửi/nhận tin nhắn real-time qua WebSocket.

---

## Tài Liệu Cần Đọc Trước

- `microservices/04-chat-service.md` — Toàn bộ
- `microservices/09-websocket-design.md` — STOMP destinations, WebSocket auth
- `microservices/07-database-design.md` — MongoDB schema

---

## Cấu Trúc Thư Mục

```
chat-service/
├── pom.xml
└── src/main/
    ├── java/com/ptitmeet/chat/
    │   ├── ChatServiceApplication.java
    │   ├── config/
    │   │   ├── SecurityConfig.java
    │   │   └── WebSocketConfig.java
    │   ├── document/
    │   │   └── ChatMessage.java          ← MongoDB Document
    │   ├── repository/
    │   │   └── ChatMessageRepository.java
    │   ├── dto/
    │   │   ├── SendMessageRequest.java
    │   │   └── ChatMessageResponse.java
    │   ├── service/
    │   │   └── ChatService.java
    │   └── controller/
    │       ├── ChatController.java        ← STOMP Controller
    │       └── ChatRestController.java   ← REST API
    └── resources/
        └── application.yml
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn đang xây dựng Chat Service cho dự án PTITMeet Microservices.

**QUAN TRỌNG**:
- Dùng MongoDB, KHÔNG phải MySQL.
- WebSocket/STOMP dùng SimpleBroker (in-memory), KHÔNG cần Redis Pub/Sub.
- userId được inject từ WebSocket session attributes (đọc từ handshake).

### DEPENDENCIES (pom.xml)

```xml
<dependencies>
  <dependency>spring-boot-starter-web</dependency>
  <dependency>spring-boot-starter-data-mongodb</dependency>
  <dependency>spring-boot-starter-websocket</dependency>
  <dependency>spring-cloud-starter-netflix-eureka-client</dependency>
  <dependency>com.ptitmeet:common:1.0.0-SNAPSHOT</dependency>
  <dependency>lombok</dependency>
  <dependency>spring-boot-starter-validation</dependency>
  <dependency>spring-boot-starter-actuator</dependency>
</dependencies>
```

### CẤU HÌNH (application.yml)

```yaml
server:
  port: 8083

spring:
  application:
    name: chat-service
  data:
    mongodb:
      uri: mongodb://${MONGO_USERNAME:ptitmeet}:${MONGO_PASSWORD:ptitmeet_mongo_pass}@${MONGO_HOST:localhost}:27017/ptitmeet_chat_db?authSource=admin
      database: ptitmeet_chat_db

eureka:
  client:
    service-url:
      defaultZone: http://${EUREKA_HOST:localhost}:8761/eureka/
  instance:
    prefer-ip-address: true
    instance-id: ${spring.application.name}:${server.port}
```

### MONGODB DOCUMENT: ChatMessage.java

```java
@Document(collection = "meeting_chats")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMessage {
    @Id
    private String id;

    @Indexed
    @Field("meeting_code")
    private String meetingCode;

    @Field("sender_id")
    private String senderId;       // Raw UUID

    @Field("sender_name")
    private String senderName;     // Snapshot tại thời điểm gửi

    private String content;

    @Field("timestamp")
    private LocalDateTime timestamp;
}
```

**Index configuration** (tạo trong WebSocketConfig hoặc MongoConfig):
```java
@Configuration
public class MongoConfig {
    @Autowired
    private MongoTemplate mongoTemplate;

    @PostConstruct
    public void createIndexes() {
        IndexOperations indexOps = mongoTemplate.indexOps("meeting_chats");
        // Compound index cho query + sort
        indexOps.ensureIndex(new CompoundIndexDefinition(
            new Document("meeting_code", 1).append("timestamp", 1)));
        // Index cho senderId
        indexOps.ensureIndex(new Index().on("sender_id", Sort.Direction.ASC));
    }
}
```

### REPOSITORY: ChatMessageRepository.java

```java
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    // Lấy lịch sử chat theo meeting_code, sort by timestamp ASC
    List<ChatMessage> findByMeetingCodeOrderByTimestampAsc(String meetingCode);

    // Phân trang nếu cần
    Page<ChatMessage> findByMeetingCodeOrderByTimestampDesc(
        String meetingCode, Pageable pageable);

    // Đếm tin nhắn
    long countByMeetingCode(String meetingCode);
}
```

### DTO

**SendMessageRequest.java** (từ STOMP client):
```java
@Data
public class SendMessageRequest {
    @NotBlank(message = "Nội dung tin nhắn không được trống")
    private String content;
    private String senderName;  // Optional, client có thể gửi kèm tên hiển thị
}
```

**ChatMessageResponse.java**:
```java
@Data @Builder
public class ChatMessageResponse {
    private String id;
    private String meetingCode;
    private String senderId;
    private String senderName;
    private String content;
    private LocalDateTime timestamp;
}
```

### WEBSOCKET CONFIG: WebSocketConfig.java

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
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns("*")
            .addInterceptors(new WebSocketHandshakeInterceptor())
            .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Intercept STOMP CONNECT frame để extract userId từ header
        registration.interceptors(new StompChannelInterceptor());
    }
}
```

**WebSocketHandshakeInterceptor.java**:
```java
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                    WebSocketHandler wsHandler,
                                    Map<String, Object> attributes) throws Exception {
        // Lấy userId từ query param hoặc header
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String userId = servletRequest.getServletRequest().getHeader("X-User-Id");
            if (userId == null) {
                userId = servletRequest.getServletRequest().getParameter("userId");
            }
            if (userId != null) {
                attributes.put("userId", userId);
                attributes.put("userName", servletRequest.getServletRequest().getHeader("X-User-Email"));
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                WebSocketHandler wsHandler, Exception exception) {}
}
```

**StompChannelInterceptor.java** (để set Principal cho convertAndSendToUser):
```java
@Component
public class StompChannelInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
            message, StompHeaderAccessor.class);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            if (sessionAttributes != null) {
                String userId = (String) sessionAttributes.get("userId");
                if (userId != null) {
                    // Set Principal để convertAndSendToUser hoạt động
                    accessor.setUser(new StompPrincipal(userId));
                }
            }
        }
        return message;
    }
}
```

**StompPrincipal.java**:
```java
public record StompPrincipal(String name) implements Principal {
    @Override
    public String getName() { return name; }
}
```

### SERVICE: ChatService.java

```java
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public ChatMessageResponse sendMessage(
        String meetingCode, String senderId, String senderName, SendMessageRequest req) {

        // 1. Validate content
        if (req.getContent().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        // 2. Resolve senderName: ưu tiên từ request, fallback session
        String name = (req.getSenderName() != null && !req.getSenderName().isBlank())
            ? req.getSenderName() : senderName;

        // 3. Save to MongoDB
        ChatMessage message = ChatMessage.builder()
            .meetingCode(meetingCode)
            .senderId(senderId)
            .senderName(name)
            .content(req.getContent())
            .timestamp(LocalDateTime.now())
            .build();
        message = chatMessageRepository.save(message);

        // 4. Build response
        ChatMessageResponse response = toResponse(message);

        // 5. Broadcast tới tất cả subscriber của phòng
        messagingTemplate.convertAndSend(
            "/topic/chat/" + meetingCode, response);

        return response;
    }

    public List<ChatMessageResponse> getChatHistory(String meetingCode) {
        return chatMessageRepository
            .findByMeetingCodeOrderByTimestampAsc(meetingCode)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    public long getMessageCount(String meetingCode) {
        return chatMessageRepository.countByMeetingCode(meetingCode);
    }

    private ChatMessageResponse toResponse(ChatMessage message) {
        return ChatMessageResponse.builder()
            .id(message.getId())
            .meetingCode(message.getMeetingCode())
            .senderId(message.getSenderId())
            .senderName(message.getSenderName())
            .content(message.getContent())
            .timestamp(message.getTimestamp())
            .build();
    }
}
```

### STOMP CONTROLLER: ChatController.java

```java
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @MessageMapping("/chat/{meetingCode}")
    public void handleChatMessage(
        @DestinationVariable String meetingCode,
        @Payload SendMessageRequest req,
        SimpMessageHeaderAccessor headerAccessor) {

        // Lấy user info từ session attributes (đã được set bởi HandshakeInterceptor)
        Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
        String senderId = (String) sessionAttrs.get("userId");
        String senderName = (String) sessionAttrs.getOrDefault("userName", "Unknown");

        if (senderId == null) {
            // Không cho gửi nếu không có userId (không qua Gateway)
            return;
        }

        chatService.sendMessage(meetingCode, senderId, senderName, req);
        // Response đã được broadcast trong sendMessage(), không cần return ở đây
    }
}
```

### REST CONTROLLER: ChatRestController.java

```java
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatRestController {

    private final ChatService chatService;

    // Lấy lịch sử chat (Meeting Service gọi nội bộ qua Phase 10)
    @GetMapping("/{meetingCode}/history")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getChatHistory(
        @PathVariable String meetingCode) {
        return ResponseEntity.ok(ApiResponse.success(
            chatService.getChatHistory(meetingCode)));
    }

    // Đếm số tin nhắn (Meeting Service gọi cho Summary)
    @GetMapping("/{meetingCode}/count")
    public ResponseEntity<ApiResponse<Long>> getMessageCount(
        @PathVariable String meetingCode) {
        return ResponseEntity.ok(ApiResponse.success(
            chatService.getMessageCount(meetingCode)));
    }
}
```

**LƯU Ý**: Endpoint /api/chat/** cũng cần được expose qua Gateway cho Meeting Service gọi nội bộ và cho user xem lịch sử. Cập nhật Gateway routing:
```java
.route("chat-service-rest", r -> r
    .path("/api/chat/**")
    .uri("lb://chat-service"))
```

### SECURITY CONFIG (Đơn giản)

Giống Identity Service: disable security, cho phép all requests.

### KIỂM TRA KẾT QUẢ

1. Kết nối WebSocket tới ws://localhost:8083/ws?userId=test-uuid (hoặc qua Gateway ws://localhost:8080/ws)
2. Subscribe tới /topic/chat/abc-defg-hij
3. Gửi STOMP frame: SEND /app/chat/abc-defg-hij với body {"content": "Xin chào!"}
4. Tất cả subscribers nhận được broadcast message
5. Message được lưu vào MongoDB: db.meeting_chats.find()
6. GET /api/chat/abc-defg-hij/history → list messages
7. GET /api/chat/abc-defg-hij/count → số lượng messages
8. Kiểm tra Eureka: chat-service đăng ký thành công
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- MongoDB setup + ChatMessage document
- WebSocket/STOMP broker (SimpleBroker)
- STOMP authentication (HandshakeInterceptor + StompChannelInterceptor)
- Send message + persist + broadcast
- REST API: lịch sử và đếm tin nhắn

❌ KHÔNG làm trong phase này:
- gRPC server cho Chat Service (Phase 10)
- Scale WebSocket (Redis Pub/Sub — scope tương lai)
- Meeting Service gọi Chat Service (Phase 10)
