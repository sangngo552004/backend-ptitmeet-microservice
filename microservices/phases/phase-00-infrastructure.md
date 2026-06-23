# Phase 00 — Infrastructure Setup

## Mục Tiêu
Thiết lập toàn bộ hạ tầng nền tảng cho dự án: cấu trúc multi-module Maven, Eureka Server, Docker Compose, và thư viện Common dùng chung.

**Kết quả sau phase này**: Eureka Server khởi động được tại port 8761, Docker Compose chạy được tất cả infrastructure services, Common library build được.

---

## Tài Liệu Cần Đọc Trước

- `microservices/00-project-overview.md` — Tech stack, Service Discovery
- `microservices/01-architecture.md` — Cấu trúc service, ports
- `microservices/07-database-design.md` — Các DB cần tạo

---

## Cấu Trúc Thư Mục Cần Tạo

```
backend-ptitmeet-microservice/
├── pom.xml                          ← Parent POM (multi-module Maven)
├── docker-compose.yml               ← Infrastructure containers
├── .env.example                     ← Template biến môi trường
│
├── common/                          ← Module thư viện dùng chung
│   ├── pom.xml
│   └── src/main/java/com/ptitmeet/common/
│       ├── dto/
│       │   └── ApiResponse.java
│       ├── exception/
│       │   ├── AppException.java
│       │   └── ErrorCode.java
│       └── handler/
│           └── GlobalExceptionHandler.java
│
└── eureka-server/                   ← Module Eureka Server
    ├── pom.xml
    └── src/main/
        ├── java/com/ptitmeet/eureka/
        │   └── EurekaServerApplication.java
        └── resources/
            └── application.yml
```

---

## Prompt Chi Tiết Cho Agent

```
Bạn là một Java Spring Boot developer. Nhiệm vụ của bạn là tạo Phase 00 của dự án PTITMeet Microservices.

### BƯỚC 1: Tạo Parent POM (pom.xml tại root)

Tạo file `pom.xml` tại thư mục gốc `backend-ptitmeet-microservice/` với:
- groupId: com.ptitmeet
- artifactId: ptitmeet-microservices
- version: 1.0.0-SNAPSHOT
- packaging: pom
- Modules: common, eureka-server (thêm dần các service khác sau)
- Spring Boot Parent: 3.2.x
- Java version: 21
- Dependency management cho:
  * spring-cloud-dependencies (2023.0.x - tương thích Boot 3.2)
  * grpc-spring-boot-starter (net.devh:grpc-server-spring-boot-starter:2.15.0.RELEASE)
  * grpc-client (net.devh:grpc-client-spring-boot-starter:2.15.0.RELEASE)
  * livekit-server (io.livekit:livekit-server:0.6.1)
  * jjwt-api, jjwt-impl, jjwt-jackson (io.jsonwebtoken:0.12.x)
  * spring-kafka (managed by spring-cloud)

### BƯỚC 2: Tạo Common Library (common/)

#### common/pom.xml
- Parent: ptitmeet-microservices
- Dependencies:
  * spring-boot-starter-web
  * spring-boot-starter-validation
  * lombok
  * mapstruct (1.5.5.Final)

#### common/.../dto/ApiResponse.java
```java
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
            .code(1000).message("Success").data(data).build();
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return ApiResponse.<T>builder()
            .code(code).message(message).data(null).build();
    }

    public static <T> ApiResponse<T> error(int code, String message, T data) {
        return ApiResponse.<T>builder()
            .code(code).message(message).data(data).build();
    }
}
```

#### common/.../exception/ErrorCode.java
Enum với các giá trị sau (code, message, HttpStatus):
- SUCCESS(1000, "Success", 200)
- VALIDATION_FAILED(4000, "VALIDATION_FAILED", 400)
- UNAUTHORIZED(4010, "UNAUTHORIZED", 401)
- JWT_EXPIRED(4011, "JWT_EXPIRED", 401)
- REFRESH_TOKEN_INVALID(4012, "REFRESH_TOKEN_INVALID", 401)
- FORBIDDEN(4030, "FORBIDDEN", 403)
- ONLY_OWNER(4031, "ONLY_OWNER_ALLOWED", 403)
- ONLY_HOST(4032, "ONLY_HOST_ALLOWED", 403)
- MEETING_NOT_FOUND(4041, "MEETING_NOT_FOUND", 404)
- USER_NOT_FOUND(4042, "USER_NOT_FOUND", 404)
- RECORDING_NOT_FOUND(4043, "RECORDING_NOT_FOUND", 404)
- PARTICIPANT_NOT_FOUND(4044, "PARTICIPANT_NOT_FOUND", 404)
- EMAIL_ALREADY_EXISTS(4091, "EMAIL_ALREADY_EXISTS", 409)
- FEEDBACK_ALREADY_SUBMITTED(4092, "FEEDBACK_ALREADY_SUBMITTED", 409)
- MEETING_NOT_ACTIVE(4093, "MEETING_NOT_ACTIVE_OR_CANCELED", 409)
- MEETING_NOT_STARTED(4220, "MEETING_NOT_STARTED_YET", 422)
- WRONG_PASSWORD(4221, "WRONG_MEETING_PASSWORD", 422)
- ACCESS_DENIED(4222, "ACCESS_DENIED_BY_MEETING_POLICY", 422)
- PARTICIPANT_KICKED(4223, "PARTICIPANT_WAS_KICKED", 422)
- RECORDING_ALREADY_RUNNING(4224, "RECORDING_ALREADY_RUNNING", 422)
- INTERNAL_SERVER_ERROR(5000, "INTERNAL_SERVER_ERROR", 500)
- SERVICE_UNAVAILABLE(5001, "SERVICE_UNAVAILABLE", 503)
- LIVEKIT_ERROR(5002, "LIVEKIT_CONNECTION_ERROR", 500)
- STORAGE_ERROR(5003, "FILE_STORAGE_ERROR", 500)

#### common/.../exception/AppException.java
```java
@Getter
public class AppException extends RuntimeException {
    private final ErrorCode errorCode;
    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
```

#### common/.../handler/GlobalExceptionHandler.java
@RestControllerAdvice xử lý:
1. MethodArgumentNotValidException → code 4000, trả list {field, message}
2. ConstraintViolationException → code 4000, trả list {field, message}
3. AppException → dùng errorCode.getCode(), errorCode.getMessage()
4. AccessDeniedException → code 4030
5. Exception (catch-all) → code 5000, log error

### BƯỚC 3: Tạo Eureka Server (eureka-server/)

#### eureka-server/pom.xml
- Parent: ptitmeet-microservices
- Dependencies:
  * spring-cloud-starter-netflix-eureka-server
  * spring-boot-starter-actuator

#### eureka-server/.../EurekaServerApplication.java
- @SpringBootApplication
- @EnableEurekaServer

#### eureka-server/resources/application.yml
```yaml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  client:
    register-with-eureka: false
    fetch-registry: false
  server:
    enable-self-preservation: false
    eviction-interval-timer-in-ms: 5000

management:
  endpoints:
    web:
      exposure:
        include: health,info
```

### BƯỚC 4: Tạo docker-compose.yml

Tạo file `docker-compose.yml` tại root với các services:

```yaml
version: '3.8'
services:
  # MySQL cho Identity Service
  mysql-identity:
    image: mysql:8.0
    container_name: ptitmeet-mysql-identity
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ptitmeet_identity_db
    ports:
      - "3307:3306"
    volumes:
      - mysql_identity_data:/var/lib/mysql
    networks:
      - ptitmeet-network

  # MySQL cho Meeting Service
  mysql-meeting:
    image: mysql:8.0
    container_name: ptitmeet-mysql-meeting
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ptitmeet_meeting_db
    ports:
      - "3308:3306"
    volumes:
      - mysql_meeting_data:/var/lib/mysql
    networks:
      - ptitmeet-network

  # MySQL cho Media Service
  mysql-media:
    image: mysql:8.0
    container_name: ptitmeet-mysql-media
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ptitmeet_media_db
    ports:
      - "3309:3306"
    volumes:
      - mysql_media_data:/var/lib/mysql
    networks:
      - ptitmeet-network

  # MongoDB cho Chat Service
  mongodb:
    image: mongo:7.0
    container_name: ptitmeet-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: ptitmeet_chat_db
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - ptitmeet-network

  # Redis cho Identity Service (token store)
  redis:
    image: redis:7.2-alpine
    container_name: ptitmeet-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - ptitmeet-network

  # Apache Kafka (KRaft mode — không cần Zookeeper)
  # Dùng image 7.9.x tương đương Kafka 3.9 (KRaft GA, stable)
  kafka:
    image: confluentinc/cp-kafka:7.9.0
    container_name: ptitmeet-kafka
    ports:
      - "9092:9092"
      - "9101:9101"    # JMX (optional, debug)
    environment:
      # ── KRaft Mode ──────────────────────────────────────────────
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller          # Single node đóng cả 2 vai trò
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:29093  # NodeId@host:controllerPort

      # ── Listeners ───────────────────────────────────────────────
      # PLAINTEXT: cho các service trong Docker network
      # CONTROLLER: dùng nội bộ cho KRaft consensus
      # PLAINTEXT_HOST: cho kết nối từ host machine (localhost:9092)
      KAFKA_LISTENERS: PLAINTEXT://kafka:29092,CONTROLLER://kafka:29093,PLAINTEXT_HOST://0.0.0.0:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER

      # ── KRaft Cluster ID (bắt buộc — phải là UUID base64 hợp lệ) ──
      # Sinh 1 lần bằng lệnh: docker run --rm confluentinc/cp-kafka:7.9.0 kafka-storage random-uuid
      # Sau đó thay vào đây, hoặc để script init tự sinh (xem volumes bên dưới)
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk

      # ── Topic / Replication ──────────────────────────────────────
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1       # Single broker → 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_DEFAULT_REPLICATION_FACTOR: 1
      KAFKA_NUM_PARTITIONS: 3
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: true

      # ── Performance / Dev settings ───────────────────────────────
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0      # Không delay rebalance trong dev
      KAFKA_LOG_RETENTION_HOURS: 168                 # 7 ngày
      KAFKA_LOG4J_ROOT_LOGLEVEL: WARN

      # ── JMX (optional) ──────────────────────────────────────────
      KAFKA_JMX_PORT: 9101
      KAFKA_JMX_HOSTNAME: localhost
    volumes:
      - kafka_data:/var/lib/kafka/data
    networks:
      - ptitmeet-network
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "kafka:29092"]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 30s

  # Eureka Server
  eureka-server:
    build: ./eureka-server
    container_name: ptitmeet-eureka
    ports:
      - "8761:8761"
    networks:
      - ptitmeet-network

volumes:
  mysql_identity_data:
  mysql_meeting_data:
  mysql_media_data:
  mongodb_data:
  redis_data:
  kafka_data:

networks:
  ptitmeet-network:
    driver: bridge
```

### BƯỚC 5: Tạo .env.example

```
# MySQL
MYSQL_ROOT_PASSWORD=ptitmeet_root_pass

# MongoDB
MONGO_USERNAME=ptitmeet
MONGO_PASSWORD=ptitmeet_mongo_pass

# Redis
REDIS_PASSWORD=ptitmeet_redis_pass

# JWT
JWT_SECRET=your-256-bit-secret-key-change-in-production

# LiveKit
LIVEKIT_HOST=https://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_WEBHOOK_SECRET=your-webhook-secret

# AWS S3
AWS_S3_BUCKET=ptitmeet-recordings
AWS_S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### KIỂM TRA KẾT QUẢ

Sau khi hoàn thành:
1. Run `mvn clean install -pl common` — phải BUILD SUCCESS
2. Run `mvn clean package -pl eureka-server` — phải BUILD SUCCESS
3. Run `docker-compose up -d mysql-identity mysql-meeting mysql-media mongodb redis kafka zookeeper` — tất cả containers phải UP
4. Start Eureka Server: `java -jar eureka-server/target/*.jar` → truy cập http://localhost:8761 phải hiện Eureka dashboard
```

---

## Giới Hạn Phase Này

✅ Làm trong phase này:
- Parent POM multi-module
- Common library (ApiResponse, ErrorCode, AppException, GlobalExceptionHandler)
- Eureka Server
- Docker Compose với tất cả infrastructure

❌ KHÔNG làm trong phase này:
- Bất kỳ business service nào (Identity, Meeting, Chat, Media, Gateway)
- gRPC proto files
- Kafka topics configuration
