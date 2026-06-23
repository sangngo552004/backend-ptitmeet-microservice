# PTITMeet Microservices - Deployment Guide

Dự án này bao gồm Frontend (React) và Backend Microservices (Java Spring Boot 21). Tài liệu này hướng dẫn chạy hệ thống ở môi trường Local và triển khai Production.

---

## 1. Chạy ở môi trường Local (Docker Compose)

### Yêu cầu
- Đã cài đặt Docker và Docker Compose
- Đã cài đặt Java 21 và Maven (nếu muốn build code)

### Khởi chạy Backend Infrastructure
Mở terminal tại thư mục gốc của dự án:
```bash
docker-compose up -d mysql mongodb kafka zookeeper redis livekit
```

### Khởi chạy ứng dụng bằng Java (Development)
1. Di chuyển vào thư mục backend: `cd backend`
2. Sử dụng IDE (IntelliJ IDEA/Eclipse) để chạy các microservice theo thứ tự:
   - `eureka-server` (Chờ start xong port 8761)
   - `api-gateway`
   - `identity-service`, `meeting-service`, `chat-service`, `media-service`

### Khởi chạy hệ thống Monitoring (Prometheus + Grafana + Loki)
Chúng tôi đã setup sẵn stack giám sát hệ thống chuyên nghiệp:
```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```
- **Grafana**: Truy cập `http://localhost:3000` (user/pass: `admin`/`admin`)
- **Prometheus**: Truy cập `http://localhost:9090`

---

## 2. Triển khai Production (AWS EC2)

Mô hình triển khai này sử dụng duy nhất 1 con EC2 để tiết kiệm chi phí cho đồ án sinh viên. Tuy nhiên, luồng CI/CD được thiết kế theo chuẩn Enterprise (Monorepo Paths Filtering).

### Chuẩn bị trên EC2
1. Mở port `80`, `443`, và các port dịch vụ cần thiết (nếu truy cập trực tiếp).
2. SSH vào EC2 và cài đặt Docker, Docker Compose.
3. Tạo thư mục chứa file cấu hình `/opt/ptitmeet`:
   - Copy file `docker-compose.yml` từ máy local lên EC2.
   - Sửa đổi file `docker-compose.yml` (hoặc tạo file `docker-compose.prod.yml`) để thêm các Java Microservices thay vì chỉ chạy DB.

*Ví dụ cấu hình cho Identity Service trong docker-compose.yml trên EC2:*
```yaml
  identity-service:
    image: your-dockerhub-user/ptitmeet-identity:latest
    container_name: identity-service
    ports:
      - "8081:8081"
    environment:
      - EUREKA_HOST=eureka-server
      - MYSQL_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - eureka-server
      - mysql
      - redis
```

### Thiết lập CI/CD (GitHub Actions)
Bạn vào tab **Settings > Secrets and variables > Actions** của repository trên GitHub để khai báo các biến bảo mật:
- `DOCKER_USERNAME`: Tên tài khoản Docker Hub của bạn
- `DOCKER_PASSWORD`: Mật khẩu Docker Hub (hoặc Access Token)
- `EC2_HOST`: Địa chỉ IP Public của con EC2
- `EC2_USER`: User ssh (thường là `ubuntu` hoặc `ec2-user`)
- `EC2_SSH_KEY`: Mã Private Key (`.pem`) dùng để SSH vào máy.

### Luồng triển khai:
Mỗi khi bạn `git push` code lên nhánh `main`:
1. **GitHub Actions** sẽ đọc file `.github/workflows/ci-cd.yml`.
2. Công cụ `paths-filter` sẽ quét xem thư mục nào có file bị thay đổi.
3. **Chỉ** những thư mục bị thay đổi mới kích hoạt lệnh build ra Docker Image tương ứng.
4. Image mới sẽ được push lên Docker Hub.
5. GitHub kết nối SSH vào EC2, gọi lệnh `docker-compose pull` và `docker-compose up -d`. Cơ chế thông minh của Docker Compose sẽ chỉ khởi động lại đúng container có bản update mới, các container khác vẫn chạy bình thường (Zero Downtime Re-creation).
