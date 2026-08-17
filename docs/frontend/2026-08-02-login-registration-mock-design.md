# Login & Registration Mock Design

## Mục tiêu

Hoàn thiện luồng Frontend cho Web Dashboard Smart Classroom P.101: đăng nhập, yêu cầu đăng ký tài khoản, thông báo chờ phê duyệt và quay lại đăng nhập. Toàn bộ dữ liệu tồn tại trong bộ nhớ trình duyệt trong phạm vi demo.

## Phạm vi giao diện

### Login (`/login`)

- Bám wireframe đã chốt: panel thông tin P.101 bên trái và card form bên phải.
- Hiển thị email/tên đăng nhập, mật khẩu, checkbox ghi nhớ, liên kết quên mật khẩu dạng demo, nút `Đăng nhập` và liên kết `Đăng ký tài khoản`.
- Khi nhập đủ email và mật khẩu hợp lệ, nút `Đăng nhập` chuyển người dùng đến `/dashboard` trong phiên React hiện tại.
- Khi bỏ trống hoặc nhập email không hợp lệ, hiển thị lỗi ngay tại form. Không lưu mật khẩu hoặc token.

### Registration (`/register`)

- Giữ cùng ngôn ngữ thiết kế với Login.
- Trường: họ tên, email, mật khẩu, xác nhận mật khẩu và loại yêu cầu.
- Chỉ cho chọn `User` hoặc `Technician`; `Manager` do Manager hiện hữu tạo/phân quyền, không tự đăng ký.
- Kiểm tra bắt buộc nhập, email hợp lệ, mật khẩu tối thiểu 8 ký tự và xác nhận mật khẩu khớp.
- Gửi hợp lệ hiển thị trạng thái `Yêu cầu đã được gửi, chờ Manager phê duyệt`; nút `Quay lại đăng nhập` dẫn tới `/login`.

## Điều hướng và trạng thái mock

```text
/login --Đăng ký tài khoản--> /register
/register --Gửi hợp lệ--> trạng thái gửi yêu cầu thành công
trạng thái thành công --Quay lại đăng nhập--> /login
/login --Đăng nhập hợp lệ--> /dashboard
/dashboard --Đăng xuất--> /login
```

- `isAuthenticated` vẫn chỉ là state trong `App.tsx`.
- Dashboard, telemetry, điều khiển thiết bị và MQTT/Gateway vẫn dùng mock data như milestone trước.
- Không có REST API, WebSocket, MQTT client, cơ sở dữ liệu hay quyền thật trong thay đổi này.

## Kiểm thử và nghiệm thu

- Bài test xác nhận Login hiển thị trước đăng nhập, đăng nhập hợp lệ đi Dashboard, liên kết đăng ký mở `/register`, đăng ký sai hiện lỗi và đăng ký hợp lệ hiện trạng thái chờ phê duyệt.
- `npm run lint`, `npm run test -- --run`, `npm run build` phải hoàn thành thành công.
- Kiểm tra thủ công: truy cập được tất cả điều hướng trên, không cần refresh ứng dụng và không gọi dịch vụ bên ngoài.
