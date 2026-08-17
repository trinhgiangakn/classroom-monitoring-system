# Foundation Auth & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, mock-data Smart Classroom web demo with login and dashboard screens for room P.101.

**Architecture:** React Router separates `/login` from the protected dashboard route. A small in-memory authentication state simulates the Manager account; all telemetry is supplied from typed local mock data so the backend and MQTT integration can be added later without rewriting the presentation components.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide React, Recharts, Vitest and Testing Library.

## Global Constraints

- Keep the application web-only; it never connects directly to MQTT.
- Use mock data only in this milestone; no backend API calls and no credentials stored in the browser.
- Reuse the agreed dark navy/cyan Smart Classroom visual style.
- The dashboard must show P.101, four nodes, AHT20, BMP280, BH1750, MQ135, MQTT/Gateway online state and 5-second telemetry context.
- Keep `web-frontend.placeholder` untouched until the generated application is verified and committed.

---

### Task 1: Test foundation and route shell

**Files:**
- Modify: `web-frontend/package.json`, `web-frontend/vite.config.ts`
- Create: `web-frontend/src/test/setup.ts`, `web-frontend/src/App.test.tsx`

- [ ] Install `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` as development dependencies.
- [ ] Add the Vitest `jsdom` environment and setup file to the Vite configuration.
- [ ] Write a failing test that expects the login heading at the initial route and the dashboard heading after the mock sign-in action.
- [ ] Implement the smallest route/auth shell to pass this test.
- [ ] Run `npm run test -- --run` and `npm run build`.

### Task 2: Shared visual layout and typed mock data

**Files:**
- Create: `web-frontend/src/types/dashboard.ts`, `web-frontend/src/data/mockDashboard.ts`
- Create: `web-frontend/src/components/layout/AppShell.tsx`, `web-frontend/src/components/layout/Sidebar.tsx`, `web-frontend/src/components/layout/Header.tsx`
- Modify: `web-frontend/src/index.css`

- [ ] Define explicit types for metrics, nodes, alerts, device state and chart points.
- [ ] Add the P.101 mock telemetry data and four NW/NE/SW/SE nodes.
- [ ] Build the responsive shell with a navigation sidebar and a common top header.
- [ ] Run the app and confirm it is legible at desktop width and at 375px width.

### Task 3: Login and dashboard presentation

**Files:**
- Create: `web-frontend/src/pages/LoginPage.tsx`, `web-frontend/src/pages/DashboardPage.tsx`
- Create: `web-frontend/src/components/dashboard/MetricCard.tsx`, `web-frontend/src/components/dashboard/NodeCard.tsx`, `web-frontend/src/components/dashboard/EnvironmentChart.tsx`, `web-frontend/src/components/dashboard/QuickControls.tsx`, `web-frontend/src/components/dashboard/AlertList.tsx`
- Modify: `web-frontend/src/App.tsx`, `web-frontend/src/App.test.tsx`

- [ ] Add a failing test proving that clicking “Đăng nhập demo” changes route/view to the dashboard.
- [ ] Implement Login with an explicit demo-account note and no password persistence.
- [ ] Implement metric cards, four node cards, telemetry chart, quick controls, and latest-alert list from mock data.
- [ ] Make mock controls update only local visual state; label this demo behavior in code.
- [ ] Run the test suite and `npm run build`.

### Task 4: Project hygiene and handoff

**Files:**
- Modify: `web-frontend/README.md`
- Recreate: `web-frontend/tests/unit/.gitkeep`, `web-frontend/tests/integration/.gitkeep`

- [ ] Document install, start, test, build, mock-data, and future API/WebSocket integration boundaries.
- [ ] Restore the repository test directory placeholders in the new Vite project.
- [ ] Verify `npm run lint`, `npm run test -- --run`, and `npm run build`.
- [ ] Review `git status` to ensure `node_modules` and `dist` are ignored and only intended source files are staged.
