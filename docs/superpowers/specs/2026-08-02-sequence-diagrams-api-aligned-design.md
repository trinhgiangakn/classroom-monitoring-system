# Sequence Diagrams — API-Aligned Design

## Purpose

This document defines the complete sequence-diagram set for the Smart Classroom Monitoring System, room P.101. The diagrams are aligned with the team's REST API, WebSocket event, and MQTT topic specifications.

## Scope and visual conventions

- Deliverable: one Draw.io file with 10 tabs.
- Tabs 01–03 remain in place and are corrected only where the API contract needs a label or role clarification.
- Language: Vietnamese, matching the existing diagram file.
- Colors: cyan for telemetry/BLE, amber for device control and MQTT commands, green for backend/MQTT processing, violet for REST/WebSocket and database interactions, red for rejected/error alternatives.
- Solid arrows mean requests, events, or state transitions. Dashed arrows mean responses, ACKs, or returns.
- The Web Dashboard never connects directly to MQTT. It communicates with Node.js Backend through REST API and WebSocket only.

## API alignment decisions

1. Manual device control and operation-mode switching are Manager-only.
2. Alert acknowledgement and resolution are Technician/Manager-only; User can read alerts.
3. The current API has no public registration, pending-approval, or registration-approval endpoint. The prior registration flow is replaced by Manager User Administration.
4. The API sensor payload does not currently expose BMP280 pressure. Do not show `pressure_hpa` as a Web/API value until Backend adds that field.
5. The API does not define reconnect retry timing. The recovery diagram shows observable LWT/status transitions, not an undocumented exponential-backoff algorithm.
6. `sensor_status_flags` is not in the current API payload. The fault diagram uses current `status`, `sensor_health`, `node:status`, and alerts. Adding per-sensor flags requires an API-contract extension.

## Diagram 01 — Telemetry thời gian thực

Status: retain existing tab.

Actors: STM32 Sensor Node, HM-10 BLE, ESP32 Gateway, MQTT Broker, Node.js Backend, MySQL, Web Dashboard.

Flow:

1. STM32 reads AHT20, BMP280, BH1750, and MQ135 on the 5-second cycle.
2. STM32 publishes BLE Advertising payload through HM-10 to ESP32 Gateway.
3. ESP32 validates packet and publishes `classroom/P.101/sensor/{node_id}/telemetry` at QoS 1.
4. Mosquitto forwards telemetry to Node.js Backend.
5. Backend stores telemetry/node status in MySQL.
6. Backend emits `sensor:update` to subscribed Web Dashboard clients.
7. Dashboard updates cards, charts, and recent records without page reload.

Note: only temperature, humidity, light, and air-quality values are shown on API/Web arrows. BMP280 is retained on the STM32 hardware label.

## Diagram 02 — Điều khiển MANUAL và ACK

Status: retain existing tab with Manager-only clarification.

Actors: Manager, Web Dashboard, Node.js Backend, MySQL, MQTT Broker, ESP32 Gateway, Relay/H-Bridge/Motor.

Flow:

1. Dashboard first loads `GET /api/devices` and displays current mode/device states.
2. Manager changes mode using `PUT /api/devices/mode` to MANUAL when necessary.
3. Backend validates JWT, role MANAGER, and MANUAL mode.
4. Manager sends `POST /api/devices/:id/control` with relay or curtain action.
5. Backend creates a PENDING_ACK command record in MySQL and returns `202 Accepted` with `command_id`.
6. Backend publishes `classroom/P.101/device/{device_id}/command` at QoS 1.
7. ESP32 performs GPIO relay/H-Bridge action and publishes ACK/status.
8. Backend updates command history and device state, then emits `device:command-update`, `device:status`, or `curtain:status`.
9. Dashboard shows ACK, final state, and execution time.

Alternative: invalid JWT, non-Manager role, or AUTO mode returns a rejection and no MQTT command is published.

## Diagram 03 — AUTO Rule Engine và cảnh báo

Status: retain existing tab.

Actors: ESP32 Gateway, MQTT Broker, Node.js Backend/Rule Engine, MySQL, Web Dashboard, ESP32 Gateway, Actuator.

Flow:

1. Backend receives QoS 1 telemetry.
2. Backend stores the telemetry and evaluates active rules.
3. Rule Engine proceeds only when room mode is AUTO and at least two valid nodes are available.
4. A matching rule creates an auto action and, when applicable, an alert record.
5. Backend publishes the command to ESP32 through MQTT.
6. ESP32 executes and sends ACK/status.
7. Backend emits `automation:action`, `device:status`, `mode:update`, and/or `alert:new` to the Dashboard.

Example: temperature > 30 °C causes the fan rule to turn the ventilation fan ON.

## Diagram 04 — Xác thực và phiên làm việc

Actors: User, Login Web UI, Node.js Backend, MySQL, WebSocket Server.

Main flow:

1. User submits username/email, password, and remember_me.
2. UI calls `POST /api/auth/login`.
3. Backend verifies credentials and user status in MySQL.
4. Backend returns JWT token, expiry, and role.
5. Dashboard calls `GET /api/auth/me` with Bearer JWT to initialize RBAC.
6. UI shows permitted navigation/actions and opens WebSocket session.
7. Logout calls `POST /api/auth/logout`; UI clears local session and returns to Login.

Alternatives:

- Invalid credentials or locked user returns failure and remains on Login.
- Forgot password calls `POST /api/auth/forgot-password`; reset page calls `POST /api/auth/reset-password` with reset token.

## Diagram 05 — Quản trị người dùng bởi Manager

Actors: Manager, Admin Web UI, Node.js Backend, MySQL, target User.

Flow:

1. Manager opens Admin/Users; UI calls `GET /api/users`.
2. Backend validates Manager JWT/RBAC and returns the user list.
3. Manager creates an account through `POST /api/users`, or edits a role/profile using `PUT /api/users/:id`.
4. Manager locks or reactivates an account using `PUT /api/users/:id/status`.
5. Backend updates MySQL and writes an audit-log entry.
6. Updated list is returned to the Admin UI.

Alternative: non-Manager role receives forbidden response and cannot access user-management actions.

## Diagram 06 — Monitoring Dashboard: REST, CSV và WebSocket

Actors: User/Technician/Manager, Monitoring Web UI, Node.js Backend, MySQL, WebSocket Server.

Flow:

1. UI requests `GET /api/sensors/latest`, `GET /api/sensors/history`, and `GET /api/sensors/recent` with room/filter parameters.
2. Backend queries MySQL and returns cards, chart series, and recent-record table.
3. When Export CSV is selected, UI calls `GET /api/sensors/export`; Backend streams the filtered CSV file.
4. UI opens WebSocket and emits `subscribe:room { room_id: "P.101" }`.
5. Backend emits `sensor:update`; UI updates only affected cards/charts/table rows in real time.
6. On leaving the room, UI emits `unsubscribe:room`.

## Diagram 07 — Cảnh báo: xem chi tiết, acknowledge và resolve

Actors: User/Technician/Manager, Alerts Web UI, Node.js Backend, MySQL, WebSocket Server.

Flow:

1. UI loads summary through `GET /api/alerts/summary` and filtered list through `GET /api/alerts`.
2. User opens an alert-detail modal locally from the selected list record.
3. Technician or Manager calls `PUT /api/alerts/:id/acknowledge` to mark it read.
4. Technician or Manager calls `PUT /api/alerts/:id/resolve` after the issue is fixed.
5. Backend updates MySQL, writes audit log, and publishes updated alert state by WebSocket.
6. All subscribed dashboards refresh summary/list state without a page reload.

Alternative: User attempts acknowledge/resolve and receives forbidden response; read-only display remains available.

## Diagram 08 — Trạng thái hệ thống và cập nhật realtime

Actors: User/Technician/Manager, System Status Web UI, Node.js Backend, MySQL, WebSocket Server.

Flow:

1. UI calls `GET /api/system/health` for Gateway, MQTT Broker, Database, and Rule Engine health.
2. UI calls `GET /api/nodes` for four STM32 node states, RSSI, packet success rate, last seen, and sensor health.
3. Technician/Manager additionally calls `GET /api/system/resources` and `GET /api/audit-logs`.
4. UI emits `subscribe:system` on WebSocket.
5. Server pushes `gateway:status`, `node:status`, and `system:resource-update` events.
6. UI updates header connection pills, node table, resource bars, and technical log.

## Diagram 09 — Quản lý luật tự động

Actors: Manager, Admin/Operation Mode Web UI, Node.js Backend/Rule Engine, MySQL, WebSocket Server.

Flow:

1. UI calls `GET /api/automation/rules` and `GET /api/automation/status`.
2. Backend returns rules, current engine status, and `min_valid_nodes_required`.
3. Manager edits a rule, threshold, enabled flag, or minimum-valid-node requirement.
4. UI sends `PUT /api/automation/rules/:id`.
5. Backend validates Manager JWT/RBAC, persists the new rule to MySQL, and updates Rule Engine configuration.
6. Backend records audit information and emits an updated automation/mode state to subscribed dashboards.

Alternative: non-Manager receives forbidden response; the rules remain read-only.

## Diagram 10 — Gateway/Node fault, status và phục hồi

Actors: STM32 Node, ESP32 Gateway, MQTT Broker, Node.js Backend, MySQL, Web Dashboard.

Flow:

1. ESP32 detects weak BLE, missing node advertisements, device event, or gateway connectivity change.
2. ESP32 publishes sensor/node status to `classroom/P.101/sensor/{node_id}/status`, gateway LWT/status to `classroom/P.101/gateway/status`, or hardware event to `classroom/P.101/device/{device_id}/event`.
3. Broker forwards status to Backend.
4. Backend persists node/gateway state and creates an alert when configured conditions are met.
5. Backend emits `node:status`, `gateway:status`, and `alert:new` to Web Dashboard.
6. Dashboard shows Offline/weak-signal condition and alert to all permitted users.
7. When ESP32/node publishes Online/healthy status again, Backend stores the recovery and emits updated status.

Constraint: current API exposes aggregate node `sensor_health` and general status only. Per-sensor failure fields such as `sensor_status_flags` require a future API payload extension.

## Acceptance criteria

- Every REST request shown uses an endpoint that exists in the API specification.
- Every WebSocket event and MQTT topic shown is named exactly as specified.
- RBAC restrictions are visible in diagrams 02, 05, 07, and 09.
- The 5-second telemetry cycle, QoS 1, and target command delay of at most 3 seconds appear where relevant.
- Diagrams are readable at 100% zoom, preserve the existing dark theme, and contain no unsupported public registration flow.
