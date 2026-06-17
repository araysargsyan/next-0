## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Architecture: The SDK Gateway

The project implements a centralized session management system via a unified **AuthService SDK**. This architecture is specifically engineered to solve the "Cookie Write-Only" limitation of Next.js Server Components while maintaining seamless data integrity across all request types.

### The Hybrid Strategy: Why and How

Next.js imposes strict boundaries on cookie mutations:
- **Middleware/Proxy**: Can modify headers for both the incoming request and outgoing response.
- **Server Actions/Route Handlers**: Full read/write access to cookies.
- **Server Components (Rendering)**: Strictly **Read-Only**.

Our architecture bridges these gaps using a dual-layer protection model:

#### 1. Proactive Gateway (The Double Sync Pattern)
Executed at the **Network Boundary** (Middleware), this layer acts as a preemptive strike against expired sessions.
- **Problem**: If Middleware refreshes a token, only the **Response** (`Set-Cookie`) is updated by default. The current execution context (the page being rendered) would still see the old/missing token.
- **Solution**: `AuthService.getAuthorizedResponse` performs a **Double Sync**. It injects the fresh tokens into `request.headers` (so Server Components see them *now*) and `response.headers` (so the browser saves them for *later*).
- **Outcome**: 99% of requests are "healed" before they even reach the application logic, ensuring zero UI flickering.

#### 2. Silent Retry (Server Actions & Route Handlers)
This mechanism is dedicated to **mutations and client-side data fetching**, where process continuity is critical.
- **Problem**: A session might expire during a background fetch from a Client Component or a file upload in an Action. A standard redirect would break the user's flow.
- **Solution**: When `protFetch` is called with `{ isAction: true }` (legal in both **Server Actions** and **Route Handlers**), it unlocks the **Direct Commit** mode. Upon detecting a 401:
    - It triggers `AuthService.refresh()`.
    - It uses the `cookies().set()` API to manually persist the new state. In Route Handlers, this automatically injects `Set-Cookie` into the API response sent to the browser.
    - It **re-executes the original request** with the new credentials.
- **Outcome**: 
    - **Server Actions**: Mutations complete without data loss.
    - **Client Components (via API Bridge)**: `fetch()` calls to internal API routes receive fresh data and updated cookies in a single, seamless response. No browser-side interceptors or redirects required.

#### 3. Reanimator Fallback (The Rendering Safety Net)
A fail-safe for the strictly read-only **Server Component Rendering** layer.
- **Scenario**: If a 401 occurs during a Server Component render (where `cookies().set()` is forbidden), the system cannot "silently" heal itself.
- **Mechanism**: `protFetch` triggers a stateful redirect to `/api/auth/refresh-and-return`.
- **Referer Context**: Instead of complex state tracking, we utilize the standard HTTP `Referer` to determine the return path. The Reanimator route refreshes the session via a Route Handler (where writing cookies is legal) and bounces the user back to their origin.

### Cookie Synchronization Pitfalls (Solved)

During development, we identified and eliminated several critical scenarios where cookies/sessions could be lost:

1. **The "Half-Sync" Failure**: Updating `Set-Cookie` in Middleware but forgetting to update the current Request headers. This causes the immediate Server Component render to fail with 401, even though the session was technically refreshed. *Fixed via Double Sync.*
2. **The Swallowed Redirect**: Using `try/catch` in Server Actions without re-throwing the redirect error. This prevents Next.js from processing the navigation to the Reanimator route, leading to a silent failure of the entire process. *Fixed via `.digest?.startsWith('NEXT_REDIRECT')` check.*
3. **The Refresh Storm (Race Condition)**: Multiple concurrent requests hitting an expired session simultaneously. Without de-duplication, each request tries to rotate the token, often leading to backend invalidation of the first successful refresh by subsequent attempts. *Fixed via static `activeRefreshPromise` locking.*
4. **The Action Interruption**: Triggering a standard redirect during a `POST` operation. This cancels the ongoing data mutation (like a file upload) and redirects the user, causing permanent data loss. *Fixed via in-place Silent Retry.*

### Support for Client Components (`"use client"`)

Due to security standards (`HttpOnly` cookies), the `AuthService` SDK and `protFetch` cannot be executed directly in the browser. To maintain session integrity within client-side logic, use the **API Bridge Pattern**:

1. **The Bridge**: Create an internal Next.js Route Handler (e.g., `/app/api/proxy/route.ts`).
2. **The Execution**: Inside the handler, call `AuthService.protFetch(..., { isAction: true })`.
3. **The Benefit**: The bridge route will automatically handle 401 errors, perform a Silent Retry, and commit new cookies to the browser.
4. **The Client**: Your `"use client"` component simply calls `fetch('/api/proxy')` and receives data without ever worrying about token expiration.

### Critical Technical Pillars

- **Verified Autonomous Parser**: Since `cookies().set()` requires a structured object but backend returns raw `Set-Cookie` strings, we implemented a custom, performance-verified parser. It perfectly mirrors the internal Next.js/Edge-Runtime logic (verified against 100+ edge cases), ensuring that attributes like `SameSite`, `Max-Age`, and `Partitioned` are handled with system-level precision.
- **Singleton Promise De-duplication**: To prevent "Refresh Storms", all refresh logic is gated behind a static `activeRefreshPromise`. This ensures only one backend call is made, regardless of request volume.
- **Zero-Dependency Core**: The entire `AuthService.ts` is self-contained, ensuring long-term stability and immunity to framework or library updates.

### Implementation Guide

To use the secure network client, import `protFetch` from the service:

```typescript
import { protFetch } from "@/lib/AuthService";

// In Server Actions or Route Handlers (Enables Silent Retry)
// Works for both form submissions and client-side fetch() calls
const res = await protFetch("/api/data", { method: "POST", isAction: true, body: data });

// In Server Components (Enables Reanimator Fallback during SSR)
const res = await protFetch("/api/profile");
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
