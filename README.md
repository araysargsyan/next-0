# Next.js 16 Unified Session Management & SDK Gateway

This repository houses a state-of-the-art authentication and session restoration architecture designed specifically for **Next.js 16.2.9**, **React 19.2**, and **Turbopack**.

At the center of this project is the **`AuthService` SDK**, a custom-built, dependency-free library located in `src/lib/auth`. The system solves Next.js's native "Cookie Write-Only" restriction inside Server Components, ensuring zero-flicker UI updates, silent session recovery, and resilient file/form actions with zero data loss.

---

## 🛠️ Tech Stack & Key Conventions

| Technology | Version | Role |
| :--- | :--- | :--- |
| **Next.js** | 16.2.9 | Framework (dynamic by default; caching is opt-in via `use cache`) |
| **React** | 19.2.4 | Render engine (Stable Server Actions and View Transitions) |
| **Turbopack** | (bundled) | Default bundler for both dev and production builds |
| **TypeScript** | ^5 | Language |
| **TailwindCSS** | v4 + PostCSS | Styling |
| **Zustand** | ^5.0.14 | Global form-state store (used by Formy persist adapter) |
| **Jest** | ^30.4.2 | Test runner with Next.js SWC compiler integration |

---

## 📁 Project Structure

```
.
├── src/
│   ├── app/                        # Next.js App Router pages and API routes
│   │   ├── (home)/                 # Authenticated home page + Server Actions
│   │   ├── about/                  # About page
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── sign-out/            # GET: Clears session cookies, redirects to /sign-in
│   │   │       └── refresh-and-return/  # GET: Reanimator bounce endpoint (delegates to AuthService)
│   │   ├── sign-in/                # Public sign-in page + Server Action
│   │   ├── layout.tsx              # Root layout (wraps children in FormStoreProvider)
│   │   ├── types.ts                # Shared API error payload types (ApiErrorPayload, ApiErrorResponse)
│   │   └── globals.css
│   ├── components/
│   │   ├── Forms/                  # App-level form components (LoginForm, ImageUploadForm)
│   │   ├── Providers/
│   │   │   └── FormStoreProvider   # Zustand store + createPersistBridge wiring for Formy
│   │   ├── UI/
│   │   │   └── Formy/              # Generic type-safe form controller (see Formy README)
│   │   └── SignOutLink.tsx         # Client component for triggering sign-out navigation
│   ├── hooks/
│   │   └── useIsomorphicLayoutEffect.ts  # SSR-safe useLayoutEffect (no-op on server)
│   ├── lib/
│   │   ├── auth/                   # AuthService SDK (see Auth README)
│   │   ├── logger.ts               # ANSI color-coded console logger factory (createLogger)
│   │   ├── store/
│   │   │   └── formStore.ts        # Zustand vanilla store (FormState + FormActions)
│   │   └── utils/
│   │       └── error.ts            # parseApiError — NestJS error payload normalizer
│   ├── config.ts                   # Global constants (API_URL, COOKIE_NAMES, AUTH_ROUTES, PUBLIC_ROUTES)
│   └── proxy.ts                    # Network boundary — entry point for all non-static requests
├── jest.config.js                  # Unified Jest config (unit + e2e projects via Jest Projects)
├── tsconfig.json
└── next.config.ts
```

---

## 🔒 Session Management & Authentication SDK

All logic relating to authentication, proactive token rotation, double cookie synchronization (proxy and browser), and silent retries is encapsulated within the custom `AuthService` SDK.

For details on the architecture (the 3-layer protection model), diagrams, pitfalls solved, Client Component integration via Server Actions, and logging prefixes, please refer to the dedicated SDK documentation:
👉 **[AuthService SDK Documentation](./src/lib/auth/README.md)**

---

## 📝 Generic Form Controller (Formy)

The project includes `Formy`, a generic, type-safe wrapper around React 19's `useActionState` and HTML `<form>`. It solves React 19's automatic `form.reset()` behavior on every action completion, which wipes user input even on validation errors. Formy intercepts input events before submission and imperatively restores field values after an error — without re-mounting or client-side hydration of static inputs.

Key capabilities:
- **Zero-rerender architecture** via decoupled `Formy` (orchestrator), `FormyCore` (DOM layer), and `FormyError` (per-field error store).
- **Cross-navigation persistence** via a store-agnostic bridge (`createPersistBridge`) wired to Zustand by default.
- **Client-side validation** via the `validate` prop on `<FormyError>` — blocks Server Action submission if client errors exist.
- **File input restoration** using `DataTransfer` after an action error.

For details on configuration, patterns, and APIs, please refer to the dedicated Formy documentation:
👉 **[Formy Component Documentation](./src/components/UI/Formy/README.md)**

---

## 🌐 API Routes

| Route | Method | Purpose |
| :--- | :--- | :--- |
| `/api/auth/sign-out` | `GET` | Deletes both session cookies (`accessToken`, `refreshToken`) and redirects to `/sign-in`. Accepts an optional `?error=` query parameter forwarded to the sign-in page. |
| `/api/auth/refresh-and-return` | `GET` | Reanimator endpoint: delegates to `AuthService.handleRefreshAndReturn()`. Rotates tokens and redirects back to the original `?returnUrl=`. |

---

## ⚙️ Network Boundary (`src/proxy.ts`)

`src/proxy.ts` is the application's network boundary — the entry point for every non-static incoming request. It runs on the **full Node.js Runtime**, enabling the use of native Node modules and arbitrary npm packages.

**Routing logic (in order):**

1. **Public routes** (configured in `PUBLIC_ROUTES` in `src/config.ts`): Pass through directly. Exception: if an already-authenticated user (has `refreshToken`) hits `/sign-in`, they are redirected to `/`.
2. **No tokens present**: Redirect immediately to `/sign-in`.
3. **Protected routes**: Delegate to `AuthService.getAuthorizedResponse()`, which performs proactive Double Sync token refresh if needed.

---

## 🚀 Execution & Verification

### Running the Dev Server
```bash
npm run dev
```

### Running All Tests
```bash
npm run test
```

### Running Unit Tests Only
```bash
npm run test:unit
```

### Running E2E Tests Only
```bash
npm run test:e2e
```

### Running TypeScript Type Checks
```bash
npm run type-check
```

### Building for Production
```bash
npm run build
```
