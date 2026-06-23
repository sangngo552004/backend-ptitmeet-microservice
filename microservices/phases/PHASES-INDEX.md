# PTITMeet Microservices — Kế Hoạch Phát Triển Theo Phase

## Nguyên Tắc Chia Phase

- Mỗi phase tạo ra code **biên dịch được và chạy được** (hoặc ít nhất là test được đơn lẻ).
- Mỗi phase tập trung vào **1 service** hoặc **1 concern xuyên suốt**.
- Prompt trong mỗi file đủ chi tiết để agent code **không cần hỏi thêm**.
- Scope mỗi phase được ước lượng ở mức **vừa đủ** để agent hoàn thành trong một lần gen code (~2000–4000 dòng code).

---

## Danh Sách Phase

| Phase | File | Nội dung | Ước lượng độ phức tạp |
|---|---|---|---|
| **Phase 00** | `phase-00-infrastructure.md` | Eureka Server + Docker Compose + Common Library | Trung bình |
| **Phase 01** | `phase-01-identity-core.md` | Identity Service: Register, Login, JWT, Redis Token | Cao |
| **Phase 02** | `phase-02-identity-advanced.md` | Identity Service: Google OAuth, Forgot/Reset, Profile, Logout | Trung bình |
| **Phase 03** | `phase-03-api-gateway.md` | API Gateway: JWT Filter, Routing, WebSocket Proxy | Trung bình |
| **Phase 04** | `phase-04-meeting-foundation.md` | Meeting Service: Setup, Entities, Create Meeting, Basic CRUD | Trung bình |
| **Phase 05** | `phase-05-meeting-join-flow.md` | Meeting Service: Join Flow (logic nghiệp vụ phức tạp nhất) | Rất Cao |
| **Phase 06** | `phase-06-meeting-host-controls.md` | Meeting Service: Leave, Host Transfer, Approval, WebSocket Events | Cao |
| **Phase 07** | `phase-07-meeting-history-summary.md` | Meeting Service: History, Summary, Feedback, Settings, Kafka Outbox | Trung bình |
| **Phase 08** | `phase-08-chat-service.md` | Chat Service: WebSocket/STOMP Broker, MongoDB, Chat Flow | Cao |
| **Phase 09** | `phase-09-media-service.md` | Media Service: LiveKit Egress, Recording, Webhook, S3 | Cao |
| **Phase 10** | `phase-10-grpc-integration.md` | gRPC: Proto definitions + Stubs cho tất cả inter-service call | Rất Cao |

---

## Thứ Tự Phụ Thuộc (Dependency Order)

```
Phase 00 (Infrastructure)
    │
    ├── Phase 01 (Identity Core)
    │       └── Phase 02 (Identity Advanced)
    │
    ├── Phase 03 (API Gateway) ← phụ thuộc Phase 01 (JWT secret)
    │
    ├── Phase 04 (Meeting Foundation)
    │       ├── Phase 05 (Meeting Join Flow)
    │       │       └── Phase 06 (Meeting Host Controls)
    │       │               └── Phase 07 (Meeting History/Summary)
    │       └── Phase 07 cũng phụ thuộc Phase 08 (Chat Service - message count)
    │
    ├── Phase 08 (Chat Service)
    │
    ├── Phase 09 (Media Service)
    │
    └── Phase 10 (gRPC Integration) ← kết nối tất cả services lại
```

## Lưu Ý Cho Agent Khi Đọc Phase

1. **Luôn đọc docs tham chiếu trước** khi bắt đầu code.
2. **Dùng đúng tech stack** được chỉ định trong phase, không tự ý thêm dependency ngoài danh sách.
3. **Các service chưa được implement** trong phase hiện tại → để TODO comment và mock interface.
4. **Test thủ công** sau khi hoàn thành: start service và verify endpoint hoạt động.
5. **Không implement** những gì thuộc scope của phase khác.
