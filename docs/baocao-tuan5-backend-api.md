# BÁO CÁO TIẾN ĐỘ THIẾT KẾ & PHÁT TRIỂN HỆ THỐNG - TUẦN 5
**Dự án:** Hệ thống Giám sát & Điều khiển Phòng học (Classroom Monitoring System)  
**Nội dung:** Hoàn thiện Backend Core, Hệ thống RESTful API & Tích hợp Web Frontend Services  
**Thời gian lưu:** 2026-08-22  

---

## I. TỔNG QUAN TIẾN ĐỘ TUẦN 5
Trong Tuần 5, dự án đã tập trung nguồn lực hoàn thiện toàn bộ tầng **Backend**, xây dựng hệ thống **RESTful API cho Web** và tích hợp đồng bộ các **Client API Services** phía Web Frontend, giúp hệ thống vận hành mượt mà thời gian thực (Real-time).

---

## II. CHI TIẾT CÁC ĐẦU VIỆC ĐÃ HOÀN THÀNH

### 1. Phát triển Backend Core & Truyền thông Thời gian thực (Real-time)
- **WebSocket Gateway (`sensor:update`):** Thiết lập kênh truyền dữ liệu cảm biến thời gian thực xuống giao diện Web Monitoring.
- **Tối ưu hóa MQTT Broker Integration:**
  - Hỗ trợ linh hoạt các topic/payload ACK và status topic gửi từ thiết bị đầu cuối ESP32.
  - Xử lý cơ chế ngẫu nhiên hóa `clientId` của Backend MQTT Client, giải quyết dứt điểm sự cố trùng lặp kết nối (connection collision) trên HiveMQ Cloud.
- **Tăng cường khả năng chịu lỗi Ingestion (Resiliency):**
  - Tự động lọc bỏ và làm sạch dữ liệu thiết bị trùng lặp (duplicate devices).
  - Nâng cao độ tin cậy của bộ parse dữ liệu telemetry đầu vào.

### 2. Xây dựng Hệ thống RESTful API Phía Web Backend (`/api/...`)
- **API Kịch bản Tự động hóa (`/api/automation`):**
  - Xây dựng trọn bộ API CRUD cho các quy tắc tự động hóa (Automation Rules).
  - Hỗ trợ API kích hoạt Rule Runtime theo điều kiện cảm biến (nhiệt độ, độ ẩm, ánh sáng, chuyển động) và lịch trình.
- **API Quản lý Cảnh báo (`/api/alerts`):**
  - Xây dựng API truy vấn danh sách cảnh báo hệ thống, hỗ trợ phân loại theo độ ưu tiên (`Low`, `Medium`, `High`, `Critical`).
  - API cập nhật trạng thái xử lý cảnh báo (`Acknowledge` / `Resolve`).
- **API Điều khiển Thiết bị & Phản hồi (`/api/devices` & `deviceController.js`):**
  - API gửi lệnh bật/tắt (Relay), điều chỉnh công suất (Dimming) cho từng thiết bị phòng học.
  - API chuyển đổi linh hoạt chế độ vận hành: **Auto (Tự động)** vs **Manual (Thủ công)**.
  - Đồng bộ cơ chế phản hồi trạng thái ACK thực tế từ Gateway / Phần cứng.
- **API Nhật ký Thao tác & Audit Log (`/api/audit`):**
  - Xây dựng API ghi nhận và truy xuất toàn bộ nhật ký thao tác người dùng (`auditMiddleware`).
- **API Xác thực & Quản trị User (`/api/auth`, `/api/users`):**
  - Tích hợp dịch vụ gửi Email khôi phục mật khẩu / OTP qua **Resend & Brevo HTTPS REST API** (khắc phục chặn cổng SMTP trên Cloud Server).
  - Bổ sung API tracking trạng thái người dùng online (`is_online`, `last_login`, `last_active_at`).

### 3. Tích hợp Tầng Web Frontend API Services (Client Integrations)
- **`adminApi.ts`:** Xây dựng service cho trang Admin — phê duyệt tài khoản mới, tạo link khôi phục mật khẩu trực tiếp, xem nhật ký audit, quản lý cấu hình.
- **`deviceApi.ts`:** Xây dựng service điều khiển thiết bị thời gian thực cho bảng điều khiển nhanh (**Quick Controls**) và trang chi tiết thiết bị (**Device Control Page**).
- **Auto-polling & Realtime Adapters:** Tích hợp bộ tự động cập nhật dữ liệu thông minh (Smart Polling 3s/5s) kết hợp WebSocket trên `MonitoringPage`, `DashboardPage` và `SystemStatusPage`.

### 4. Cơ sở Dữ liệu & Migrations
- **Migration `014_extend_automation_alert_runtime.sql`:** Mở rộng bảng `automation_rules` & `alerts` phục vụ tính toán runtime.
- **Migration `015_create_external_weather_data_table.sql`:** Tạo bảng lưu trữ dữ liệu thời tiết ngoài trời (Hanoi Weather Context API).
- **Migration `016_add_user_online_tracking.sql`:** Bổ sung các cột theo dõi trạng thái online của người dùng (`is_online`, `last_login`, `last_active_at`).

### 5. Cải tiến Hạ tầng & Khắc phục Lỗi (System Stability)
- **Sửa lỗi MySQL Connection Drop:** Cấu hình `keepAlive`, `connectTimeout` và đồng bộ SSL Canonical Pool cho Aiven MySQL.
- **Sửa lỗi cú pháp SQL:** Thay thế toàn bộ ngoặc đôi thành ngoặc đơn phù hợp với chế độ `ANSI_QUOTES` trong `deviceService` và `automation routes`.
- **Chuẩn hóa Múi giờ:** Đồng bộ toàn bộ hệ thống về múi giờ chuẩn **GMT+7 (Việt Nam)** trên cả Backend, Database và Frontend.

---

## III. ĐỊNH HƯỚNG ĐẦU VIỆC TUẦN 6
- [ ] Tiến hành phân tích & triển khai các đầu việc nâng cấp tiếp theo cho Tuần 6.
- [ ] Hoàn thiện tích hợp thử nghiệm tích hợp toàn hệ thống (End-to-End Testing).
- [ ] Tối ưu hóa hiệu năng & trải nghiệm người dùng (UI/UX polish).

---
*Báo cáo được lưu trữ tự động bởi Antigravity Assistant.*
