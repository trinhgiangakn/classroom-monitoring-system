# Dashboard Subpages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add five interactive mock Dashboard pages and URL-based Sidebar navigation for Smart Classroom P.101.

**Architecture:** React Router owns the selected page through six authenticated routes. A protected layout supplies the existing AppShell, Sidebar and Header once; each page renders only its content. Page state and sensor/device records live in mock data or local React state so no network integration is introduced.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind CSS v4, Lucide React, Recharts, Vitest and Testing Library.

## Global Constraints

- All telemetry, device commands, alerts, user settings and logs are Frontend mock data only.
- The browser must not call REST API, WebSocket, MQTT, Database or external service.
- Telemetry display model: four nodes NODE-NW, NODE-NE, NODE-SW, NODE-SE using AHT20, BMP280, BH1750 and MQ135.
- The Sidebar routes are /dashboard, /monitoring, /devices, /alerts, /system-status and /admin.
- AUTO locks manual device controls; MANUAL permits local UI interaction only.
- Admin is shown only for the current Manager demo identity.
- Preserve Login, Registration and existing Dashboard visual language.

---

## File structure

- src/components/layout/DashboardLayout.tsx: protected shared shell and React Router Outlet.
- src/components/layout/Sidebar.tsx: route-aware navigation.
- src/components/layout/Header.tsx: route-aware breadcrumb title.
- src/pages/DashboardPage.tsx: existing overview content only, without a nested AppShell.
- src/pages/MonitoringPage.tsx: filters, charts, recent telemetry table and CSV download.
- src/pages/DeviceControlPage.tsx: mock MANUAL/AUTO controls and curtain actions.
- src/pages/AlertsPage.tsx: summary, filters, list and local-detail modal.
- src/pages/SystemStatusPage.tsx: service/node status and mock technical log.
- src/pages/AdminPage.tsx: Manager-only mock administration tabs.
- src/data/mockMonitoring.ts and src/data/mockSystem.ts: page-specific records and pure CSV builder.
- src/App.tsx: authenticated route tree.
- src/App.test.tsx plus page tests: route and interaction behavior.

### Task 1: Create the authenticated dashboard route shell

**Files:**
- Create: src/components/layout/DashboardLayout.tsx
- Modify: src/App.tsx
- Modify: src/components/layout/AppShell.tsx
- Modify: src/components/layout/Sidebar.tsx
- Modify: src/components/layout/Header.tsx
- Modify: src/pages/DashboardPage.tsx
- Modify: src/App.test.tsx

**Interfaces:**
- Consumes: isAuthenticated and onLogout from App.
- Produces: DashboardLayout({ onLogout: () => void }) and six protected paths rendered through Outlet.

- [ ] **Step 1: Write failing route navigation tests**

```tsx
window.history.pushState({}, '', '/dashboard')
await user.click(screen.getByRole('link', { name: 'Giám sát dữ liệu' }))
expect(await screen.findByRole('heading', { name: 'Giám sát dữ liệu môi trường' })).toBeInTheDocument()

window.history.pushState({}, '', '/monitoring')
render(<App />)
expect(await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeInTheDocument()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: npm run test -- --run src/App.test.tsx  
Expected: FAIL because Sidebar has buttons instead of route links and /monitoring is not protected.

- [ ] **Step 3: Implement the protected shared layout and route-aware navigation**

```tsx
export function DashboardLayout({ onLogout }: { onLogout: () => void }) {
  return <AppShell onLogout={onLogout}><Outlet /></AppShell>
}

<Route element={isAuthenticated ? <DashboardLayout onLogout={() => setIsAuthenticated(false)} /> : <Navigate replace to="/login" />}>
  <Route element={<DashboardPage />} path="/dashboard" />
</Route>
```

Use NavLink entries with to and label, derive the Header breadcrumb from useLocation, and remove the nested AppShell from DashboardPage.

- [ ] **Step 4: Run tests to verify they pass**

Run: npm run test -- --run src/App.test.tsx  
Expected: PASS; clicking the Sidebar changes URL/content and anonymous dashboard routes redirect to Login.

- [ ] **Step 5: Commit only the route-shell files**

```powershell
git add web-frontend/src/App.tsx web-frontend/src/App.test.tsx web-frontend/src/components/layout web-frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add protected dashboard navigation"
```

### Task 2: Build the Monitoring page with mock CSV export

**Files:**
- Create: src/data/mockMonitoring.ts
- Create: src/data/mockMonitoring.test.ts
- Create: src/pages/MonitoringPage.tsx
- Create: src/pages/MonitoringPage.test.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: SensorNode from types/dashboard and environmentSeries from mockDashboard.
- Produces: buildTelemetryCsv(records: TelemetryRecord[]): string and MonitoringPage.

- [ ] **Step 1: Write failing tests for filtering and CSV content**

```tsx
expect(buildTelemetryCsv([telemetryRecords[0]])).toContain('node,temperature,humidity,pressure,light,airQuality')
await user.selectOptions(screen.getByLabelText('Node cảm biến'), 'NODE-NE')
expect(screen.getByText('NODE-NE')).toBeInTheDocument()
expect(screen.queryByText('NODE-NW')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: npm run test -- --run src/data/mockMonitoring.test.ts src/pages/MonitoringPage.test.tsx  
Expected: FAIL because telemetry records, CSV builder and MonitoringPage do not exist.

- [ ] **Step 3: Implement records, CSV builder and page**

```ts
export function buildTelemetryCsv(records: TelemetryRecord[]) {
  const rows = records.map((record) =>
    [record.time, record.node, record.temperature, record.humidity, record.pressure, record.light, record.airQuality].join(','),
  )
  return ['time,node,temperature,humidity,pressure,light,airQuality', ...rows].join('\\n')
}
```

Render the exact approved layout: time/node/metric selects, export button, temperature-humidity chart, light chart and table. Create a Blob download only from buildTelemetryCsv(filteredRecords).

- [ ] **Step 4: Run tests to verify they pass**

Run: npm run test -- --run src/data/mockMonitoring.test.ts src/pages/MonitoringPage.test.tsx  
Expected: PASS; filter limits displayed rows and CSV includes the expected header.

- [ ] **Step 5: Commit only monitoring files**

```powershell
git add web-frontend/src/data/mockMonitoring.ts web-frontend/src/data/mockMonitoring.test.ts web-frontend/src/pages/MonitoringPage.tsx web-frontend/src/pages/MonitoringPage.test.tsx web-frontend/src/App.tsx
git commit -m "feat: add mock monitoring page"
```

### Task 3: Build the Device Control page

**Files:**
- Create: src/pages/DeviceControlPage.tsx
- Create: src/pages/DeviceControlPage.test.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: initialDevices and DeviceState from mockDashboard/types/dashboard.
- Produces: DeviceControlPage with mode state MANUAL | AUTO and local device states.

- [ ] **Step 1: Write failing interaction tests**

```tsx
await user.click(screen.getByRole('button', { name: 'AUTO' }))
expect(screen.getByText('Chế độ AUTO đang khóa điều khiển tay.')).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Bật đèn chiếu' })).toBeDisabled()

await user.click(screen.getByRole('button', { name: 'MANUAL' }))
await user.click(screen.getByRole('button', { name: 'Tắt đèn chiếu' }))
expect(screen.getByText('Đèn chiếu: Tắt')).toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: npm run test -- --run src/pages/DeviceControlPage.test.tsx  
Expected: FAIL because DeviceControlPage and its controls do not exist.

- [ ] **Step 3: Implement the approved device-control layout**

```tsx
const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
const controlsLocked = mode === 'AUTO'

<button onClick={() => setMode('MANUAL')}>MANUAL</button>
<button onClick={() => setMode('AUTO')}>AUTO</button>
```

Include device cards for light, fan and humidifier, plus curtain buttons Mở, Dừng and Đóng. All handlers update only local state and show a mock status message.

- [ ] **Step 4: Run test to verify it passes**

Run: npm run test -- --run src/pages/DeviceControlPage.test.tsx  
Expected: PASS; AUTO disables manual controls and MANUAL changes local device status.

- [ ] **Step 5: Commit only device-control files**

```powershell
git add web-frontend/src/pages/DeviceControlPage.tsx web-frontend/src/pages/DeviceControlPage.test.tsx web-frontend/src/App.tsx
git commit -m "feat: add mock device controls"
```

### Task 4: Build Alerts with detail modal

**Files:**
- Create: src/pages/AlertsPage.tsx
- Create: src/pages/AlertsPage.test.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: AlertItem and alerts from types/dashboard/mockDashboard.
- Produces: AlertsPage with selectedAlert and local alert status state.

- [ ] **Step 1: Write failing modal and acknowledge tests**

```tsx
await user.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0])
expect(screen.getByRole('dialog', { name: 'Chi tiết cảnh báo' })).toBeInTheDocument()

await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
expect(screen.getByText('Đã đọc')).toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: npm run test -- --run src/pages/AlertsPage.test.tsx  
Expected: FAIL because AlertsPage and its accessible dialog do not exist.

- [ ] **Step 3: Implement alert cards, filters, table and modal**

```tsx
{selectedAlert ? (
  <div aria-label="Chi tiết cảnh báo" aria-modal="true" role="dialog">
    <button onClick={() => markRead(selectedAlert.id)}>Đánh dấu đã đọc</button>
  </div>
) : null}
```

Use local copies of mock alerts for read/processed status; filter by severity and status before rendering the alert list.

- [ ] **Step 4: Run test to verify it passes**

Run: npm run test -- --run src/pages/AlertsPage.test.tsx  
Expected: PASS; detail opens as a dialog and acknowledge changes the mock status.

- [ ] **Step 5: Commit only alert files**

```powershell
git add web-frontend/src/pages/AlertsPage.tsx web-frontend/src/pages/AlertsPage.test.tsx web-frontend/src/App.tsx
git commit -m "feat: add mock alerts page"
```

### Task 5: Build System Status page

**Files:**
- Create: src/data/mockSystem.ts
- Create: src/pages/SystemStatusPage.tsx
- Create: src/pages/SystemStatusPage.test.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: sensorNodes and system mock records.
- Produces: SystemStatusPage showing services, node health and technical logs.

- [ ] **Step 1: Write failing content test**

```tsx
render(<SystemStatusPage />)
expect(screen.getByText('Eclipse Mosquitto')).toBeInTheDocument()
expect(screen.getByText('NODE-NE')).toBeInTheDocument()
expect(screen.getByText('BLE RSSI -81 dBm')).toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: npm run test -- --run src/pages/SystemStatusPage.test.tsx  
Expected: FAIL because the System Status page and mock services do not exist.

- [ ] **Step 3: Implement service, node and log panels**

```ts
export const systemServices = [
  { name: 'Eclipse Mosquitto', status: 'Online', detail: 'MQTT QoS 1' },
  { name: 'ESP32 Gateway', status: 'Online', detail: 'BLE Scan + Wi-Fi' },
  { name: 'MySQL Database', status: 'Online', detail: 'Mock connection' },
]
```

Render the approved cards for services and four nodes, metrics telemetry 5 giây/target command ≤ 3 giây, then mock log entries.

- [ ] **Step 4: Run test to verify it passes**

Run: npm run test -- --run src/pages/SystemStatusPage.test.tsx  
Expected: PASS; the page shows service, weak NODE-NE RSSI and status log.

- [ ] **Step 5: Commit only system-status files**

```powershell
git add web-frontend/src/data/mockSystem.ts web-frontend/src/pages/SystemStatusPage.tsx web-frontend/src/pages/SystemStatusPage.test.tsx web-frontend/src/App.tsx
git commit -m "feat: add mock system status page"
```

### Task 6: Build Manager Admin tabs

**Files:**
- Create: src/pages/AdminPage.tsx
- Create: src/pages/AdminPage.test.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: current mock Manager identity in Header.
- Produces: AdminPage with activeTab state users | thresholds | rules | audit.

- [ ] **Step 1: Write failing tab interaction test**

```tsx
render(<AdminPage />)
await user.click(screen.getByRole('tab', { name: 'Ngưỡng cảnh báo' }))
expect(screen.getByText('Nhiệt độ tối đa')).toBeInTheDocument()
expect(screen.queryByText('Danh sách người dùng')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: npm run test -- --run src/pages/AdminPage.test.tsx  
Expected: FAIL because AdminPage and tab roles do not exist.

- [ ] **Step 3: Implement the four Manager mock tabs**

```tsx
const [activeTab, setActiveTab] = useState<'users' | 'thresholds' | 'rules' | 'audit'>('users')
<button aria-selected={activeTab === 'thresholds'} onClick={() => setActiveTab('thresholds')} role="tab">
  Ngưỡng cảnh báo
</button>
```

Use a role="tablist", one role="tabpanel", local form values for thresholds/rules, and a static audit table. Do not render a Manager self-registration option.

- [ ] **Step 4: Run test to verify it passes**

Run: npm run test -- --run src/pages/AdminPage.test.tsx  
Expected: PASS; tab click changes visible panel content.

- [ ] **Step 5: Commit only admin files**

```powershell
git add web-frontend/src/pages/AdminPage.tsx web-frontend/src/pages/AdminPage.test.tsx web-frontend/src/App.tsx
git commit -m "feat: add mock manager admin page"
```

### Task 7: Document the mock boundary and verify the full application

**Files:**
- Modify: web-frontend/README.md
- Modify: docs/superpowers/specs/2026-08-02-dashboard-subpages-design.md
- Modify: docs/superpowers/plans/2026-08-02-dashboard-subpages.md

**Interfaces:**
- Consumes: completed routes and page components.
- Produces: documentation that names the six routes and excludes API/MQTT integration.

- [ ] **Step 1: Update README route and mock behavior list**

Add the five routes, CSV mock behavior, local AUTO/MANUAL state, alert modal and Manager-only UI note. State explicitly that no server request is created.

- [ ] **Step 2: Run full quality checks**

Run:

```powershell
npm run lint
npm run test -- --run
npm run build
```

Expected: lint exits 0, every test passes and TypeScript/Vite production build exits 0.

- [ ] **Step 3: Manually verify the browser demo**

Open /dashboard, then click each Sidebar route. Confirm the active styling follows the page. On /devices, toggle AUTO then verify manual buttons lock. On /alerts, open Detail and close/acknowledge the modal. On /admin, switch every tab.

- [ ] **Step 4: Commit documentation only**

```powershell
git add web-frontend/README.md docs/superpowers/specs/2026-08-02-dashboard-subpages-design.md docs/superpowers/plans/2026-08-02-dashboard-subpages.md
git commit -m "docs: describe dashboard mock pages"
```

## Plan self-review

- Spec coverage: Tasks 1-6 cover all six routes, five requested screens, Sidebar active state, mock controls, alert modal, system status and Admin tabs. Task 7 verifies no integration boundary through documentation and checks.
- Placeholder scan: no unresolved requirements or generic implementation steps remain.
- Type consistency: route shell uses DashboardLayout, pages remain route elements, telemetry CSV uses TelemetryRecord and every route is named consistently with the approved design.
