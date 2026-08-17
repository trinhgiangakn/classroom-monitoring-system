# API-Aligned Smart Classroom Sequence Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Smart Classroom Draw.io sequence-diagram file from three completed tabs to ten API-aligned tabs suitable for mentor review.

**Architecture:** Preserve tabs 01–03 as the baseline; only add API/RBAC clarification labels where the diagram already contains the related interaction. Add tabs 04–10 with the existing dark canvas, actor headers, dashed lifelines, color-coded arrows, notes, and alt/error boxes. The file remains a single editable Draw.io artifact.

**Tech Stack:** Draw.io XML (`.drawio`), XML validation, Draw.io visual inspection/export.

## Global Constraints

- Source artifact: `deliverables/week2_sequence_diagrams/sequence_diagrams_smart_classroom_color_locked.drawio`.
- Do not remove or rewrite the completed business sequence of tabs 01–03.
- Vietnamese labels; preserve the existing font scale and dark visual language.
- REST endpoints, WebSocket events, MQTT topics, and RBAC must match `2026-08-02-sequence-diagrams-api-aligned-design.md` exactly.
- Web Dashboard only uses REST API and WebSocket; it never connects directly to MQTT.
- Do not draw public registration/pending-account approval because the current API has no such endpoint.

---

### Task 1: Preserve the baseline and prepare the common sequence template

**Files:**
- Modify: `deliverables/week2_sequence_diagrams/sequence_diagrams_smart_classroom_color_locked.drawio`
- Reference: `docs/superpowers/specs/2026-08-02-sequence-diagrams-api-aligned-design.md`

**Interfaces:**
- Consumes: tabs 01–03 and the colors/typography already in the source file.
- Produces: an unchanged baseline and a repeatable page template for tabs 04–10.

- [ ] **Step 1: Inspect the source pages and record invariant visual properties**

Record page dimensions, title style, actor header style, lifeline style, arrow colors, note/alt box style, and footer legend from tabs 01–03.

- [ ] **Step 2: Verify the baseline before editing**

Run: open the `.drawio` file in diagrams.net and confirm the tabs named `01 - Telemetry thời gian thực`, `02 - Điều khiển Manual có ACK`, and `03 - AUTO Rule Engine và cảnh báo` are readable.

Expected: exactly three existing tabs are present and no diagram text overlaps at the normal presentation zoom.

- [ ] **Step 3: Create page templates for authentication and dashboard actors**

Create reusable actor columns for `User/Manager/Technician`, `Web Dashboard`, `Node.js Backend`, `MySQL`, and `WebSocket Server`. For hardware pages, add `STM32 Node`, `ESP32 Gateway`, and `Mosquitto MQTT Broker` only when the flow uses them.

- [ ] **Step 4: Validate XML page count after preparation**

Run: parse the Draw.io XML and count `<diagram>` elements.

Expected: the file remains valid XML and contains at least the three preserved source diagrams before new tabs are appended.

### Task 2: Add user-facing API flows (tabs 04–07)

**Files:**
- Modify: `deliverables/week2_sequence_diagrams/sequence_diagrams_smart_classroom_color_locked.drawio`
- Reference: `docs/superpowers/specs/2026-08-02-sequence-diagrams-api-aligned-design.md` sections “Diagram 04” through “Diagram 07”.

**Interfaces:**
- Consumes: the common Web/Backend/MySQL/WebSocket template from Task 1.
- Produces: four new sequence tabs that can be reviewed independently.

- [ ] **Step 1: Add tab 04 — Xác thực và phiên làm việc**

Draw `POST /api/auth/login`, credential lookup, JWT/role response, `GET /api/auth/me`, RBAC UI initialization, WebSocket session, and `POST /api/auth/logout`. Add an `alt` box for invalid/locked credentials and a second `alt` branch for forgot/reset password using `/api/auth/forgot-password` and `/api/auth/reset-password`.

- [ ] **Step 2: Add tab 05 — Quản trị người dùng bởi Manager**

Draw `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `PUT /api/users/:id/status`, MySQL update, and audit-log write. Add a red `alt` box: non-Manager request returns forbidden and no user data is changed.

- [ ] **Step 3: Add tab 06 — Monitoring Dashboard: REST, CSV và WebSocket**

Draw the initial calls `GET /api/sensors/latest`, `GET /api/sensors/history`, `GET /api/sensors/recent`, and response rendering. Draw `GET /api/sensors/export` returning CSV stream. Then draw `subscribe:room { room_id: P.101 }`, `sensor:update`, live UI update, and `unsubscribe:room` when leaving the screen.

- [ ] **Step 4: Add tab 07 — Cảnh báo: xem chi tiết, acknowledge và resolve**

Draw `GET /api/alerts/summary`, `GET /api/alerts`, local detail modal, `PUT /api/alerts/:id/acknowledge`, `PUT /api/alerts/:id/resolve`, MySQL/audit update, and WebSocket refresh. Add a red `alt` box for User attempting acknowledge/resolve.

- [ ] **Step 5: Inspect tab labels and content**

Expected tab names: `04 - Xác thực và phiên làm việc`, `05 - Quản trị người dùng`, `06 - Monitoring REST & WebSocket`, and `07 - Xử lý cảnh báo`.

### Task 3: Add operational API flows (tabs 08–10)

**Files:**
- Modify: `deliverables/week2_sequence_diagrams/sequence_diagrams_smart_classroom_color_locked.drawio`
- Reference: `docs/superpowers/specs/2026-08-02-sequence-diagrams-api-aligned-design.md` sections “Diagram 08” through “Diagram 10”.

**Interfaces:**
- Consumes: Web/Backend/MySQL/WebSocket template and hardware actor labels from Task 1.
- Produces: system monitoring, rule configuration, and recovery sequence tabs.

- [ ] **Step 1: Add tab 08 — Trạng thái hệ thống và cập nhật realtime**

Draw `GET /api/system/health`, `GET /api/nodes`, and for Technician/Manager `GET /api/system/resources` plus `GET /api/audit-logs`. Draw `subscribe:system`, then `gateway:status`, `node:status`, and `system:resource-update` updating Header, node table, resources, and log.

- [ ] **Step 2: Add tab 09 — Quản lý luật tự động**

Draw `GET /api/automation/rules`, `GET /api/automation/status`, Manager edits, `PUT /api/automation/rules/:id`, JWT/RBAC check, MySQL update, Rule Engine reload, audit log, and WebSocket state update. Add a red `alt` box for non-Manager role.

- [ ] **Step 3: Add tab 10 — Gateway/Node fault, status và phục hồi**

Draw ESP32 publishing node status, Gateway LWT/status, or device event to the exact MQTT topics. Draw broker forwarding, Backend persistence/alert, and WebSocket `node:status`, `gateway:status`, and `alert:new`. Draw the later Online/healthy status and UI recovery. Include a note that current API exposes aggregate `sensor_health`, not per-sensor flags.

- [ ] **Step 4: Verify MQTT labels against the topic matrix**

Expected labels include `classroom/P.101/sensor/{node_id}/status`, `classroom/P.101/gateway/status`, and `classroom/P.101/device/{device_id}/event` with QoS 1 where appropriate.

### Task 4: Correct baseline API labels and complete delivery QA

**Files:**
- Modify: `deliverables/week2_sequence_diagrams/sequence_diagrams_smart_classroom_color_locked.drawio`
- Reference: `docs/superpowers/specs/2026-08-02-sequence-diagrams-api-aligned-design.md`

**Interfaces:**
- Consumes: all ten Draw.io tabs.
- Produces: a visually readable, API-aligned deliverable.

- [ ] **Step 1: Add non-destructive clarifications to existing tabs**

On tab 01, keep BMP280 only on hardware-side labels and do not place an unsupported pressure field on API/Web arrows. On tab 02, add `Manager Only` and `PUT /api/devices/mode` context. On tab 03, keep the `AUTO + ≥ 2 valid nodes` decision rule visible.

- [ ] **Step 2: XML consistency check**

Run: parse the Draw.io XML and confirm exactly ten `<diagram>` elements with sequence numbers 01 through 10.

Expected: no XML parse errors; all ten page names are present.

- [ ] **Step 3: Visual QA in diagrams.net**

Open every tab at the presentation zoom. Confirm all actor titles, endpoint labels, alternatives, and footnotes are readable; no connector crosses an unrelated actor label; no text overlaps the border/footer.

- [ ] **Step 4: Export delivery previews**

Export each tab as PNG or PDF for mentor submission and retain the editable `.drawio` source.

- [ ] **Step 5: Final API checklist**

Verify: Manager-only control/rule/user actions; Technician/Manager alert actions; User read-only alert behavior; REST/WebSocket-only Web client; no public registration flow; no undocumented pressure/sensor-flags claims.
