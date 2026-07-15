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

## 6. React Server Components (RSC) vs Client Components
To write efficient App Router code, understand where components execute:

### React Server Components (RSC)
- **Convention**: Default component type in Next.js (no `"use client"` directive).
- **Execution**: Runs **exclusively on the server**.
- **Client Bundle**: Never shipped to the browser. Zero JS footprint.
- **Capabilities**: Can read files, query databases directly, and use `async/await` in component bodies.
- **Limitations**: Cannot use state/effects hooks (`useState`, `useEffect`) or browser APIs.

### Client Components
- **Convention**: Marked with `"use client"` at the top of the file.
- **Execution**: Runs **both on the server** (pre-rendered to HTML during SSR) **and in the browser** (hydrated by React).
- **Client Bundle**: Shipped to the browser and executed during hydration.
- **Capabilities**: Full access to state, effects, context, event handlers, and browser APIs.

> **RSC Children Pattern**: Passing Server Components as `children` to Client Components preserves their RSC status. The children are serialized on the server and rendered on the client as pre-built elements without executing component code in the browser.

## 7. Rendering Modes: Static vs Dynamic Rendering
Next.js determines the rendering lifecycle at the route level:

### Static Rendering (Default)
- **Concept**: Routes are rendered at **build time** (or in the background during revalidation).
- **Caching**: The generated HTML and RSC payload are cached and served instantly via a CDN.
- **Triggers**: Automatic unless dynamic APIs (like `cookies()`, `headers()`, or `searchParams`) or uncached data fetches are detected. Can be forced with `export const dynamic = "force-static"`.

### Dynamic Rendering
- **Concept**: Routes are rendered at **request time** on every request.
- **Behavior**: The server generates fresh HTML and RSC payload on demand.
- **Triggers**: Accessing cookies, headers, search parameters, or non-cached data fetches.

## 8. Passing Client Functions to Server Components / Elements
There is a common misconception that you cannot pass client functions (callbacks, event handlers) to Server Components. In React and Next.js, this is actually fully supported via two distinct patterns:

### Pattern A: Server Components Rendered Inside Client Components (Conversion)
If a component is written without the `"use client"` directive (traditionally a Server Component), but it is imported and rendered directly inside a Client Component (a file with `"use client"`), **it automatically compiles and executes as a Client Component** for that subtree.
Because it runs on the client, you can pass any client-side functions (like `onClick`, `onChange`, or custom callbacks) to it as props without any RSC boundary errors.

### Pattern B: Client-Side Cloning (RSC Children + `cloneElement`)
A Server Component renders a component/element (like a native `<input>`) and passes it as `children` (or via any ReactNode prop) to a Client Component. 
Since the Client Component executes in the browser during hydration, it can intercept this pre-rendered Server element and attach client-side event handlers and refs to it dynamically using `cloneElement`:

```tsx
// Inside Client Component:
export function ClientWrapper({ children }) {
    const handleClientEvent = () => { ... };
    return cloneElement(children, { onChange: handleClientEvent });
}
```
This pattern allows the markup to be rendered once on the server (RSC), while still receiving interactive client functions in the browser. (This is the foundation of how Formy's `<FormyInput>` receives client event handlers).

---
*Last updated: July 15, 2026*
