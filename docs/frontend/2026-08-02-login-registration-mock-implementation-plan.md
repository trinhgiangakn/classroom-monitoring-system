# Login & Registration Mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive Frontend-only registration request flow and revise Login to match the approved P.101 wireframe.

**Architecture:** `App.tsx` owns the in-memory authenticated state while React Router maps Login, Registration and Dashboard paths. `LoginPage` and `RegistrationPage` manage their own form fields and validation; neither component uses network calls, persistent credentials or MQTT.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS v4, Vitest and Testing Library.

## Global Constraints

- All authentication and registration behaviors are Frontend mock behavior only.
- The browser must not call REST API, WebSocket, MQTT, database or external services.
- Registration can request only `User` or `Technician`; `Manager` cannot self-register.
- Valid registration shows the approval-pending state, then returns to Login only on user action.
- Existing Dashboard mock telemetry and local controls remain unchanged.

---

### Task 1: Specify failing navigation and validation tests

**Files:**
- Modify: `web-frontend/src/App.test.tsx`
- Create: `web-frontend/src/pages/RegistrationPage.test.tsx`

**Interfaces:**
- Consumes: `App` default export and `RegistrationPage` with `onBackToLogin: () => void`.
- Produces: executable behavior checks for Login-to-Register navigation and registration validation.

- [ ] **Step 1: Add the failing Login-to-Register test**

```tsx
await user.click(screen.getByRole('link', { name: 'Đăng ký tài khoản' }))
expect(await screen.findByRole('heading', { name: 'Đăng ký tài khoản' })).toBeInTheDocument()
```

- [ ] **Step 2: Add failing validation tests**

```tsx
await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu đăng ký' }))
expect(screen.getByText('Họ và tên là bắt buộc.')).toBeInTheDocument()
```

- [ ] **Step 3: Run the focused tests**

Run: `npm run test -- --run src/App.test.tsx src/pages/RegistrationPage.test.tsx`

Expected: failing because the route, link and component do not exist.

### Task 2: Implement reusable auth-frame and Registration form

**Files:**
- Create: `web-frontend/src/components/auth/AuthFrame.tsx`
- Create: `web-frontend/src/pages/RegistrationPage.tsx`
- Modify: `web-frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: callback `onNavigateToRegister: () => void` from `LoginPage`.
- Produces: `LoginPage({ onDemoLogin, onNavigateToRegister })` and `RegistrationPage({ onBackToLogin })`.

- [ ] **Step 1: Implement `AuthFrame`**

```tsx
export function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#050d1a]">{children}</main>
}
```

- [ ] **Step 2: Revise Login**

Add controlled email/password fields, inline error text and a `Link` named `Đăng ký tài khoản`; valid submit calls `onDemoLogin`.

- [ ] **Step 3: Implement Registration**

Use controlled `fullName`, `email`, `password`, `confirmPassword`, `requestedRole` and `submitted` state. Validate each required field, email format, eight-character password and matching confirmation before setting `submitted`.

- [ ] **Step 4: Run tests**

Run: `npm run test -- --run src/App.test.tsx src/pages/RegistrationPage.test.tsx`

Expected: all tests pass.

### Task 3: Connect routes and verify application quality

**Files:**
- Modify: `web-frontend/src/App.tsx`
- Modify: `web-frontend/README.md`

**Interfaces:**
- Consumes: `RegistrationPage` and the existing `DashboardPage`.
- Produces: `/login`, `/register`, `/dashboard`, and logout navigation with no backend calls.

- [ ] **Step 1: Add `/register` route**

```tsx
<Route element={<RegistrationPage onBackToLogin={() => navigate('/login')} />} path="/register" />
```

- [ ] **Step 2: Document demo login/registration boundaries**

State that registration is an approval request mock and no credential is persisted or sent over the network.

- [ ] **Step 3: Run final checks**

Run each command separately:

```powershell
npm run lint
npm run test -- --run
npm run build
```

Expected: lint exits 0, all tests pass, production build exits 0.
