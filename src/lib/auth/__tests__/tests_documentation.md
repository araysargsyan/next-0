# AuthService Testing Documentation

This document describes the testing architecture, scenarios, and execution instructions for the `AuthService` library.

---

## 🧪 What Kind of Tests Are These?

These are **Unit Tests** running on **Jest**. 

They focus on verifying the core logic, state transformations, and edge cases of the `AuthService` engine in complete isolation:
- **No Backend Connection**: All API requests to the backend server are mocked.
- **No Browser/Next.js Runtime Requirement**: Next.js framework APIs (`cookies()`, `headers()`, `redirect()`, `NextRequest`, `NextResponse`) are mocked at the module level using Jest.
- **In-Memory & Fast**: The entire 21-test suite runs in less than **1.3 seconds** on Jest.

---

## 🏗️ Mocking Strategy (Jest Module Mocking)

We mock all Next.js server-side modules at the module level using `jest.mock()`. This allows `AuthService` to import and use Next.js APIs directly without needing a dependency injection container in production.

1.  **`next/headers`**:
    We mock `cookies` and `headers` to return mock stores (`mockCookies` and `mockHeaders`) that can be controlled and inspected using Jest spies (`jest.fn()`).
2.  **`next/navigation`**:
    We mock `redirect` to record the target URL in a `mockRedirect` spy and throw a specific `REDIRECT_THROWN` error to simulate Next.js's native redirect behavior (which throws an error to halt execution).
3.  **`next/server`**:
    We mock `NextRequest` and `NextResponse` inside the `jest.mock('next/server')` factory to avoid hoisting ReferenceErrors. They act as lightweight, pure-JS representations of Next.js Edge request and response objects.

---

## 📝 Logging Strategy (Clean Terminal Logs)

To keep test output clean and easy to debug:
- **No Stack Traces**: All `console.log` calls are intercepted via `jest.spyOn(console, 'log')` and redirected to `process.stdout.write`. This prevents Jest from appending annoying stack trace lines (e.g. `at log (src/lib/logger.ts...)`).
- **Indentation**: Logs printed during a test's execution are automatically indented by 4 spaces.
- **Test Boundaries**: The `beforeEach` and `afterEach` hooks extract the current test number (e.g. `5.3`) using `expect.getState().currentTestName` and print clear start/end markers:
  ```text
  [START] >>> 5.3
      AuthService [REANIMATOR-START]: (/dashboard) Re-authenticating and returning
      AuthService [REFRESH-START]: (/dashboard) Refreshing tokens...
      AuthService [REFRESH-FINISH]: (/dashboard) -> Success {"count":2}
      AuthService [REANIMATOR-FINISH]: (/dashboard) -> Success, redirecting back
  [END]   <<< 5.3
  ```

---

## 📋 Test Scenarios Breakdown

The suite consists of **21 test cases** organized into **5 functional sections**:

### 1. Cookie Parser & Commit
Tests the parsing of backend `Set-Cookie` header strings into structured JavaScript objects.

*   **1.1 Parse Standard Cookie**: Asserts that all core cookie attributes (`Domain`, `Path`, `Max-Age`, `HttpOnly`, `Secure`, `SameSite`, `Priority`, `Partitioned`) are extracted correctly.
*   **1.2 Parse Empty Cookie Values (Fix validation)**: Verifies that deletion headers (e.g., `accessToken=; Max-Age=0`) are parsed correctly as empty strings `""` rather than being dropped.
*   **1.3 Normal Casing normalization**: Asserts that case-insensitive fields (like `SameSite=STRICT` or `Priority=MEDIUM`) are normalized to lowercase.
*   **1.4 Multi-cookie Commit**: Asserts that `commitCookies` successfully writes multiple cookies into the Next.js `cookieStore`.

### 2. Low-Level Token Refresh
Tests backend request generation and responses for token rotation.

*   **2.1 Success Rotation**: Asserts that if backend returns 200 with raw `Set-Cookie` headers, they are parsed and returned as `success: true` alongside raw strings.
*   **2.2 Empty Cookies Error**: Asserts that if backend returns 200 but has no cookie headers, it returns `success: false`.
*   **2.3 Rejection Error**: Asserts that if backend returns 401/500, it returns `success: false`.
*   **2.4 Timeout/Abort Safety**: Asserts that if the backend fetch hangs or triggers a timeout, it catches the exception and fails gracefully.

### 3. Middleware Gateway
Tests pre-emptive session recovery inside the API Proxy / Middleware.

*   **3.1 Access Token Present**: Asserts that if the access token is valid, request flows through unmodified.
*   **3.2 No Tokens Present**: Asserts that if both tokens are missing, it flows through unmodified (allowing public route configurations to handle redirection).
*   **3.3 Double Sync Refresh Success**: Asserts that if the access token is missing but refresh token exists:
    - It calls the refresh backend.
    - **Request cookies** are updated (so Server Components see them on current render).
    - **Response headers** are appended (so the browser saves them).
    - Returns `isRefreshed: true`.
*   **3.4 Double Sync Refresh Failure**: Asserts that if refresh fails in middleware, it redirects immediately to the sign-out route.
*   **3.5 x-url Header Injection**: Asserts that `getAuthorizedResponse` injects the `x-url` header containing the current requested URL into the request headers.

### 4. Smart HTTP Client / Silent Retry
Tests client calls made inside Server Actions, Route Handlers, and Server Components.

*   **4.1 Normal Request**: Asserts that a standard request runs normally on 200 OK.
*   **4.2 Silent Retry in Actions (Success)**: Asserts that if a Server Action receives a 401:
    - It triggers `refresh()`.
    - It writes the new cookies to the store.
    - It retries the original request with the *new* credentials, returning success.
*   **4.3 Silent Retry in Actions (Failure)**: Asserts that if the Action refresh fails, it redirects the user to the sign-out route.
*   **4.4 Reanimator Redirect**: Asserts that if a Server Component (rendering context where writing cookies is illegal) hits a 401, it performs a stateful redirect to `/refresh-bounce?returnUrl=...`.
*   **4.5 Instant Sign-out on Missing Refresh**: Asserts that if an Action hits 401 but has no refresh token, it skips the backend call and redirects to sign-out immediately.

### 5. Reanimator Handler
Tests the GET handler `/api/auth/refresh-and-return` bouncing users back after a background refresh.

*   **5.1 Bounce Success**: Asserts that if refresh succeeds, it redirects back to the original page and appends updated `Set-Cookie` headers.
*   **5.2 Bounce Failure**: Asserts that if refresh fails, it redirects to sign-out.
*   **5.3 Missing Token Bounce**: Asserts that if no refresh token is in store, it redirects to sign-out immediately.

---

## 🚀 Execution Instructions

Run tests using the project's configured npm script:
```bash
npm run test
```

*Under the hood, this executes:*
```bash
jest
```
*(Uses Jest to execute all `.test.ts` files in the project).*
