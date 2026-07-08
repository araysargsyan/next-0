# Next.js 16.2.9 Migration & Architecture Notes

This document captures the key architectural shifts and nuances of Next.js 16.2.9 as implemented in this project.

## 1. Proxy vs Middleware
- **Convention**: `middleware.ts` is deprecated. The new standard is `src/proxy.ts`.
- **Runtime**: `proxy.ts` now runs on the **full Node.js Runtime** instead of the restricted Edge Runtime.
- **Capabilities**: You can now use native Node modules (`fs`, `crypto`, etc.) and the full npm ecosystem directly within the proxy layer.
- **Role**: It acts as a **Network Boundary** for proxying, rewrites, and redirects.
- **Export**: Must use `export default function proxy(req: NextRequest)`.

## 2. Default Dynamic Behavior
- **Opt-in Caching**: Everything is **dynamic by default**. Caching must be explicitly requested using the `use cache` directive or specific configuration.
- **Impact**: This simplifies auth logic as we don't have to fight aggressive default caching for sensitive requests.

## 3. Server Component Cookie Limitations
- **Read-Only**: Server Components remain read-only for cookies.
- **Modification**: Cookies can only be modified in **Proxy**, **Route Handlers**, or **Server Actions**.
- **The "Redirect Loop" Pattern**: To update cookies from a Server Component during a data fetch (e.g., on a 401 error), a redirect to a dedicated Route Handler (like `/api/auth/refresh-and-return`) is required.

## 4. Double Sync Pattern (Middleware/Proxy)
- To ensure Server Components see fresh tokens in the same request cycle where a refresh occurred, the Proxy must:
    1. Update the `Set-Cookie` header in the **Response** (for the browser).
    2. Update the `Cookie` header in the **Request** (for the current execution context).

## 5. Tooling
- **Turbopack**: Now the default bundler for both development and production builds.
- **React 19.2**: Stable support for View Transitions and advanced hydration fixes.

---
*Last updated: Wednesday, June 17, 2026*
