# Thiết kế các màn hình Dashboard con — Smart Classroom P.101

## Mục tiêu

Bổ sung năm màn hình Web Dashboard có thể truy cập từ Sidebar, giữ nguyên giao diện dark navy/cyan hiện có. Toàn bộ dữ liệu và thao tác chỉ là mô phỏng Frontend; không gọi REST API, WebSocket, MQTT hay cơ sở dữ liệu.

## Điều hướng

| Mục Sidebar | Route | Quyền demo |
|---|---|---|
| Tổng quan | /dashboard | User, Manager, Technician |
| Giám sát dữ liệu | /monitoring | User, Manager, Technician |
| Điều khiển thiết bị | /devices | User (Manual), Manager |
| Cảnh báo | /alerts | User, Manager, Technician |
| Trạng thái hệ thống | /system-status | User xem cơ bản; Manager/Technician xem chi tiết |
| Quản trị | /admin | Manager |

AppShell, Sidebar và Header được tái sử dụng trên mọi màn hình sau khi đăng nhập. Sidebar xác định mục đang chọn theo URL hiện tại.

## Màn hình

### Giám sát dữ liệu

- Hiển thị bộ lọc thời gian, node và loại chỉ số.
- Biểu đồ nhiệt độ/độ ẩm, biểu đồ ánh sáng và bảng bản ghi gần đây từ bốn node NW, NE, SW, SE.
- Nút Xuất CSV tạo tệp CSV từ dữ liệu mock trên trình duyệt.

### Điều khiển thiết bị

- Có chọn chế độ MANUAL hoặc AUTO.
- MANUAL: người dùng tương tác công tắc Đèn chiếu, Quạt thông gió, Máy cấp ẩm và nút Rèm cửa Mở/Dừng/Đóng.
- AUTO: các điều khiển tay bị khóa và có thông báo giải thích.
- Mọi thay đổi chỉ tồn tại trong trạng thái React của trình duyệt; không phát lệnh đến ESP32.

### Cảnh báo

- Có các thẻ đếm cảnh báo Nghiêm trọng, Cảnh báo, Thông tin và Đã xử lý.
- Có bộ lọc mức độ, nguồn, trạng thái và thời gian.
- Danh sách cảnh báo có nút Chi tiết; nút này mở modal trên cùng trang.
- Trong modal, nút Đánh dấu đã đọc hoặc Xác nhận xử lý chỉ cập nhật dữ liệu mock.

### Trạng thái hệ thống

- Trình bày trạng thái MQTT Broker, Gateway ESP32, Database và bốn node cảm biến.
- Hiển thị các chỉ số mô phỏng: RSSI, lần thấy cuối, chu kỳ telemetry 5 giây và độ trễ lệnh mục tiêu không quá 3 giây.
- Hiển thị danh sách log kỹ thuật mock, không lấy log thật.

### Quản trị

- Chỉ Manager thấy/đi vào được trong UI mock.
- Bốn tab: Người dùng, Ngưỡng cảnh báo, Luật tự động, Nhật ký thao tác.
- Các nút chỉnh sửa và trạng thái có thể đổi ở Frontend để trình diễn, không ghi dữ liệu thật.
- Người dùng chỉ có thể yêu cầu User hoặc Technician ở màn đăng ký; Manager không tự đăng ký.

## Kiến trúc Frontend

- App.tsx khai báo sáu protected routes sau đăng nhập.
- Sidebar dùng NavLink hoặc đường dẫn hiện tại thay cho nút tĩnh.
- Mỗi trang là một component nhỏ trong src/pages.
- Dữ liệu mock được đặt trong src/data; component chỉ nhận dữ liệu/handler cần thiết.
- Component dùng lại gồm: bảng node, thẻ trạng thái, bộ lọc, modal cảnh báo và khối điều khiển thiết bị.

## Tiêu chí chấp nhận

1. Nhấn mọi mục Sidebar mở đúng route và có trạng thái active.
2. Không đăng nhập thì mọi route Dashboard chuyển về /login.
3. Mọi màn dùng đúng AppShell, không thay đổi Dashboard tổng quan hiện có.
4. Các filter, chế độ điều khiển, modal cảnh báo và tab quản trị có phản hồi trực quan bằng dữ liệu mock.
5. Trình duyệt không gửi request mạng đến Backend, MQTT, WebSocket hoặc Database.
6. Lint, test và production build đều chạy thành công.

## Ngoài phạm vi

- API, xác thực thật, RBAC phía server, WebSocket, MQTT, lưu dữ liệu và điều khiển phần cứng.
- Telemetry cảm biến thật và cơ chế ACK từ Gateway.
- Màn Mobile hoặc ứng dụng Mobile.
