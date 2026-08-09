# Dev 2 - IoT Data

Thư mục này chỉ chứa phần CSDL thuộc phạm vi Dev 2: nhận dữ liệu MQTT, lưu telemetry, chống trùng bản tin QoS 1, tổng hợp dữ liệu giờ/ngày và cung cấp dữ liệu cho API cảm biến, node và gateway.

## Phạm vi sở hữu

- Bảng: `gateways`, `gateway_metrics`, `sensor_nodes`, `sensor_data`, `sensor_data_hourly`, `sensor_data_daily`.
- MQTT subscribe:
  - `classroom/{room_id}/sensor/{node_id}/telemetry`
  - `classroom/{room_id}/sensor/{node_id}/status`
  - `classroom/{room_id}/gateway/status`
  - `classroom/{room_id}/gateway/metrics`
- REST API dùng các query trong thư mục này:
  - `/api/sensors/*`
  - `/api/nodes/*`
  - `/api/gateway/status`
- Dữ liệu cho WebSocket event: `sensor:update`, `node:status`, `gateway:status`, `system:resource-update`.

Không đặt schema/query của xác thực, người dùng, audit log, điều khiển thiết bị, rule engine hoặc cảnh báo trong module này.

## Các tệp

- `schema.sql`: sáu bảng Dev 2, view dữ liệu cảm biến mới nhất/trung bình phòng và các procedure rollup/retention.
- `seed.sql`: dữ liệu demo cho một ESP32 Gateway và bốn node STM32 của phòng `P.101`.
- `queries.sql`: query mẫu cho bốn MQTT subscription, REST API thuộc Dev 2, CSV export và các job tổng hợp dữ liệu.

## Điều kiện trước khi chạy

Phần migration hạ tầng dùng chung phải tạo trước database `classroom_monitoring`, bảng `rooms` và bản ghi phòng `P.101`. Module Dev 2 chỉ tham chiếu `rooms`; nó không tạo hoặc sửa bảng ngoài phạm vi sở hữu.

```powershell
mysql -u root -p classroom_monitoring < database/mysql/schema.sql
mysql -u root -p classroom_monitoring < database/mysql/seed.sql
```

## Quy tắc ingestion

- Backend tạo `ingest_key` ổn định từ định danh phòng, node, gói tin và thời điểm lấy mẫu. Unique key trên `sensor_data.ingest_key` biến bản tin MQTT QoS 1 gửi lại thành thao tác no-op.
- Bản tin lỗi/thiếu vẫn có thể được lưu với `data_status` là `PARTIAL` hoặc `INVALID` và chi tiết trong `error_flags`; dữ liệu này không được đưa vào rollup.
- Telemetry, trạng thái node, trạng thái gateway và metrics phải dùng thời gian UTC.
- Node được đánh dấu `OFFLINE` sau 15 giây mất tín hiệu bởi worker MQTT/status của Dev 2; schema lưu `last_seen_at` để worker thực hiện kiểm tra này.
- Dữ liệu thô được giữ 90 ngày. Scheduler gọi các procedure:

```sql
CALL sp_rollup_sensor_data_hourly(
  UTC_TIMESTAMP() - INTERVAL 2 HOUR,
  UTC_TIMESTAMP() - INTERVAL 1 HOUR
);

CALL sp_rollup_sensor_data_daily(
  UTC_DATE() - INTERVAL 2 DAY,
  UTC_DATE() - INTERVAL 1 DAY
);

CALL sp_purge_expired_sensor_data(90);
```

## Ánh xạ WebSocket

- Telemetry insert thành công mới phát `sensor:update`; bản tin trùng không phát lại event.
- Thay đổi trạng thái/RSSI node phát `node:status`.
- Thay đổi kết nối Gateway, Wi-Fi hoặc MQTT phát `gateway:status`.
- Metrics Gateway mới phát `system:resource-update`.

Phần khởi tạo WebSocket engine, room subscription và ping/pong thuộc Dev 4; Dev 2 chỉ cung cấp payload/event của dữ liệu IoT.
