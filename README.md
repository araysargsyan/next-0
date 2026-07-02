# Next.js 16 Unified Session Management & SDK Gateway

This repository houses a state-of-the-art authentication and session restoration architecture designed specifically for **Next.js 16.2.9**, **React 19.2**, and **Turbopack**. 

At the center of this project is the **`AuthService` SDK**, a custom-built, dependency-free library located in `src/lib`. The system solves Next.js's native "Cookie Write-Only" restriction inside Server Components, ensuring zero-flicker UI updates, silent session recovery, and resilient file/form actions with zero data loss.

---

## 🛠️ Tech Stack & Key Conventions

- **Framework**: Next.js 16.2.9 (Dynamic by default; caching is opt-in via `use cache`).
- **Render Engine**: React 19.2 (Stable Server Actions and View Transitions).
- **Bundler**: Turbopack (default for dev and builds).
- **Network Boundary**: `src/proxy.ts` (replaces deprecated `middleware.ts`). Runs on the **full Node.js Runtime**, enabling the use of native Node modules and arbitrary npm packages.
- **Styling**: TailwindCSS v4 with PostCSS.
- **Testing**: Jest with Next.js SWC compiler integration.

---

## 🔒 Session Management & Authentication SDK

All logic relating to authentication, proactive token rotation, double cookie synchronization (proxy and browser), and silent retries is encapsulated within the custom `AuthService` SDK.

For details on the architecture (the 3-layer protection model), diagrams, pitfalls solved, Client Component integration via Server Actions, and logging prefixes, please refer to the dedicated SDK documentation:
👉 **[AuthService SDK Documentation (src/lib/auth/README.md)](file:///C:/Users/arays/Documents/Projects/next-0/src/lib/auth/README.md)**

---

## 🚀 Execution & Verification

### Running the Dev Server
Launch Turbopack in development mode:
```bash
npm run dev
```

### Running Unit Tests
The unit test suite runs on Jest, using the Next.js SWC compiler to compile TypeScript on the fly:
```bash
npm run test
```

### Running TypeScript Type Checks
Verify all type safety and compile-time correctness across the codebase:
```bash
npm run type-check
```

### Building for Production
Verify hydration, compiling, and type safety:
```bash
npm run build
```
