# Smart Class Web Frontend

Giao diện web cho hệ thống giám sát và điều khiển phòng học thông minh P.101.

## Công nghệ

- React + TypeScript + Vite
- React Router
- Tailwind CSS
- Recharts và Lucide React

## Chạy bản demo

```powershell
cd D:\Projects\classroom-monitoring-system\web-frontend
npm install
npm run dev
```

Mở đúng địa chỉ `Local` mà Vite in ra (ví dụ `http://localhost:5173`).

Tài khoản demo đăng nhập:

- Email: `khanh.manager@smartclass.vn`
- Mật khẩu: `demo12345`

## Phạm vi hiện tại

Đây là frontend mock data, chưa gọi REST API, WebSocket hoặc MQTT trực tiếp. Các route hiện có:

- `/login`, `/register`
- `/dashboard` — tổng quan
- `/monitoring` — giám sát dữ liệu
- `/devices` — điều khiển thiết bị
- `/alerts` — cảnh báo và cửa sổ chi tiết
- `/system-status` — trạng thái kỹ thuật
- `/admin` — quản trị (giao diện Manager)

Điều khiển MANUAL/AUTO, thiết bị, rèm cửa, bộ lọc, popup cảnh báo và tab quản trị hiện chỉ thay đổi state React cục bộ. Khi backend sẵn sàng, frontend sẽ tích hợp qua REST API và WebSocket; lệnh điều khiển sẽ đi từ Backend tới MQTT rồi ESP32 Gateway.

## Kiểm tra chất lượng

```powershell
npm run lint
npm run test -- --run
npm run build
```
