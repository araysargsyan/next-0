# AuthService Testing Documentation

This document describes the testing architecture, scenarios, and execution instructions for the `AuthService` library.

---

## 🧪 What Kind of Tests Are These?

These are **Unit Tests**. 

They focus on verifying the core logic, state transformations, and edge cases of the `AuthService` engine in complete isolation:
- **No Backend Connection**: All API requests to the backend server are mocked.
- **No Browser/Next.js Runtime Requirement**: Next.js framework APIs (`cookies()`, `headers()`, `redirect()`, `NextRequest`, `NextResponse`) are stubbed out via **Dependency Inversion**.
- **In-Memory & Fast**: The entire 21-test suite runs in less than **60 milliseconds**.

---

## 🏗️ Mocking Strategy (Dependency Inversion in Action)

Rather than mocking the `AuthService` itself (which can hide logic bugs), we test the actual class engine. We do this by passing **mock implementations** for all external boundaries during test instantiation:

1. **`MockCookieStore`**: A plain JavaScript object store mimicking Next.js's read/write `cookies()` API.
2. **`MockHeadersList`**: A simple key-value map mimicking Next.js's `headers()` API.
3. **`MockNextRequest` & `MockNextResponse`**: Lightweight representations of Next.js Edge Runtime request and response models, bypassing heavy server setup.
4. **Branching Fetch Spy (`mock.fn()`)**: Instead of returning hardcoded values, our fetch mock inspects the request target and resolves custom responses dynamically (e.g., returns 401 for resources but mock set-cookies for the refresh endpoint).

---

## 📋 Test Scenarios Breakdown

The suite consists of **21 test cases** organized into **5 functional suites**:

### Suite 1: Cookie Parser & Commit (`parseSetCookie`, `commitCookies`)
Tests the parsing of backend `Set-Cookie` header strings into structured JavaScript objects.

*   **1.1 Parse Standard Cookie**: Asserts that all core cookie attributes (`Domain`, `Path`, `Max-Age`, `HttpOnly`, `Secure`, `SameSite`, `Priority`, `Partitioned`) are extracted correctly.
*   **1.2 Parse Empty Cookie Values (Fix validation)**: Verifies that deletion headers (e.g., `accessToken=; Max-Age=0`) are parsed correctly as empty strings `""` rather than being dropped.
*   **1.3 Normal Casing normalization**: Asserts that case-insensitive fields (like `SameSite=STRICT` or `Priority=MEDIUM`) are normalized to lowercase.
*   **1.4 Multi-cookie Commit**: Asserts that `commitCookies` successfully writes multiple cookies into the Next.js `cookieStore`.

### Suite 2: Low-Level Token Refresh (`refresh`)
Tests backend request generation and responses for token rotation.

*   **2.1 Success Rotation**: Asserts that if backend returns 200 with raw `Set-Cookie` headers, they are parsed and returned as `success: true` alongside raw strings.
*   **2.2 Empty Cookies Error**: Asserts that if backend returns 200 but has no cookie headers, it returns `success: false` and redirects to sign-out.
*   **2.3 Rejection Error**: Asserts that if backend returns 401/500, it triggers a redirect to sign-out.
*   **2.4 Timeout/Abort Safety**: Asserts that if the backend fetch hangs or triggers a timeout, it catches the exception and fails gracefully.

### Suite 3: Middleware Gateway (`getAuthorizedResponse`)
Tests pre-emptive session recovery inside Next.js Middleware.

*   **3.1 Access Token Present**: Asserts that if the access token is valid, request flows through unmodified.
*   **3.2 No Tokens Present**: Asserts that if both tokens are missing, it flows through unmodified (allowing public route configurations to handle redirection).
*   **3.3 Double Sync Refresh Success**: Asserts that if the access token is missing but refresh token exists:
    - It calls the refresh backend.
    - **Request cookies** are updated (so Server Components see them on current render).
    - **Response headers** are appended (so the browser saves them).
    - Returns `isRefreshed: true`.
*   **3.4 Double Sync Refresh Failure**: Asserts that if refresh fails in middleware, it redirects immediately to the sign-out route.
*   **3.5 x-url Header Injection**: Asserts that `getAuthorizedResponse` injects the `x-url` header containing the current requested URL into the request headers.

### Suite 4: Smart HTTP Client / Silent Retry (`protFetch`)
Tests client calls made inside Server Actions, Route Handlers, and Server Components.

*   **4.1 Normal Request**: Asserts that a standard request runs normally on 200 OK.
*   **4.2 Silent Retry in Actions (Success)**: Asserts that if a Server Action receives a 401:
    - It triggers `refresh()`.
    - It writes the new cookies to the store.
    - It retries the original request with the *new* credentials, returning success.
*   **4.3 Silent Retry in Actions (Failure)**: Asserts that if the Action refresh fails, it redirects the user to the sign-out route.
*   **4.4 Reanimator Redirect**: Asserts that if a Server Component (rendering context where writing cookies is illegal) hits a 401, it performs a stateful redirect to `/refresh-bounce?returnUrl=...`.
*   **4.5 Instant Sign-out on Missing Refresh**: Asserts that if an Action hits 401 but has no refresh token, it skips the backend call and redirects to sign-out immediately.

### Suite 5: Reanimator Handler (`handleRefreshAndReturn`)
Tests the GET handler `/api/auth/refresh-and-return` bouncing users back after a background refresh.

*   **5.1 Bounce Success**: Asserts that if refresh succeeds, it redirects back to the original page and appends updated `Set-Cookie` headers.
*   **5.2 Bounce Failure**: Asserts that if refresh fails, it redirects to sign-out.
*   **5.3 Missing Token Bounce**: Asserts that if no refresh token is in store, it redirects to sign-out immediately.

---

## 🚀 Execution Instructions

Since the tests use Node's **native test runner** (`node:test`) and **type-stripping engine**, execution is completely package-free.

Run tests using the project's configured npm script:
```bash
npm run test
```

*Under the hood, this executes:*
```bash
npx tsx --test src/lib/auth/__tests__/AuthService.test.ts
```
*(Uses lightweight TS execution to strip typings and pass them straight to Node's built-in testing library).*
