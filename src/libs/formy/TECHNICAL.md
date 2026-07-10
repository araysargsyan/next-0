# Formy — Technical Documentation

> Internal architecture, implementation decisions, and performance analysis.
> For usage guide and API reference, see [README.md](./README.md).

---

## 1. Zero-Rerender Architecture

Formy achieves zero unnecessary re-renders via a decoupled three-component architecture:

1. **`Formy` (Orchestrator):** Manages `useActionState` and initializes lightweight external stores. It does *not* render the form DOM itself.
2. **`FormyCore` (DOM Layer):** Handles the `<form>` element, input event interception, and DOM value restoration. Dynamically loaded only when needed.
3. **`FormyError` (Local State):** Subscribes directly to an external `ErrorsStore` and handles real-time client validation locally via its own `useState`.

Server errors propagate through the `ErrorsStore` (an external observer created via `createErrorsStore`), not through React state in the parent `Formy`. This means `FormyError` components receive updates without triggering any parent or sibling re-renders.

**Result:** Typing in one input or receiving a server validation error *never* triggers a re-render of the parent `<Formy>` component or sibling inputs. Only the specific `<FormyError>` for the affected field re-renders.

---

## 2. DOM Synchronization: Value Restoration

### Why Direct DOM Manipulation?

Formy's core purpose is to keep `<input>` fields as **React Server Components** — pure static HTML with zero JS hydration weight. Because RSC inputs are **uncontrolled** (no `useState`, no `onChange` from React), the only way to restore their values after React 19's automatic `form.reset()` + RSC refresh is **direct DOM manipulation**.

### The Mechanism

- **`setNativeValue(input, value)`** — Reads the native browser setter via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set`, calls it, and dispatches a bubbling `"input"` event. React intercepts this synthetic event and keeps its Virtual DOM in sync.
- **`setNativeChecked(input, checked)`** — Same pattern but via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked").set` + dispatches a bubbling `"change"` event. Required for checkboxes and radios, which use `.checked` instead of `.value`.

### Why Alternatives Don't Work for RSC Inputs

1. **`defaultValue` via server response** — `useActionState` is a client hook; RSC inputs cannot access it. And `children` is opaque `ReactNode` — the client `<Formy>` parent cannot inject props into RSC children.
2. **`onSubmit` + `e.preventDefault()`** — Prevents `form.reset()` but not the RSC refresh, which re-renders inputs with original `defaultValue`.
3. **React Context** — RSC cannot consume context (`useContext` is client-only).
4. **`useOptimistic` / render props** — Both require inputs to become client components, defeating the purpose.

**Conclusion:** `setNativeValue` / `setNativeChecked` via native property descriptors is the **only viable approach** for restoring uncontrolled RSC input values while keeping them as server-rendered static HTML.

---

## 3. Dynamic Loading

`FormyCore` (the heavy DOM-manipulation layer) is loaded via `next/dynamic`:

```tsx
const FormyCoreDynamic = dynamic(() => import("./FormyCore").then(m => ({ default: m.FormyCore })));
```

**Why:** `FormyCore` contains all the DOM restoration machinery (`setNativeValue`, `setNativeChecked`, `savedValuesRef`, `restoreFromValues`, etc.) that is **only needed** when `children` is a `ReactNode` (uncontrolled/RSC mode). When `children` is a render-prop function (controlled mode), none of this code is needed.

**Result:** In controlled/render-prop mode, the `FormyCore` chunk is **never downloaded** — the browser only loads the lightweight `<form>` path.

### `shouldBypassCore` Branching

The rendering path is determined by inspecting the `children` type:

```tsx
{shouldBypassCore ? (
    formAction ? (
        <Form ref={formRef} action={formAction} onSubmit={handleLightSubmit} ...>
            {typeof children === "function" ? children(state, formyContextValue.isPending) : children}
        </Form>
    ) : (
        <form ref={formRef} onSubmit={handleLightSubmit} ...>
            {typeof children === "function" ? children(state, formyContextValue.isPending) : children}
        </form>
    )
) : (
    <FormyCoreDynamic ...>
        {children}
    </FormyCoreDynamic>
)}
```

- **`shouldBypassCore = true`** — Render-prop children (controlled mode) or `plainMode` → lightweight `<form>` / `<Form>` directly.
- **`shouldBypassCore = false`** — ReactNode children (RSC/uncontrolled mode) → dynamically loaded `FormyCoreDynamic`.

---

## 4. Zero-Rerender Loading Barrier

During `FormyCore` dynamic loading, the form content is wrapped in a natively disabled fieldset *inside* `FormyCore`:

```tsx
<fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
    {children}
</fieldset>
```

### Lifecycle

1. Server render + initial client paint: fieldset is `disabled` → all inputs are non-interactive.
2. `FormyCore` chunk finishes loading and mounts on the client → triggers a local `useEffect` mount callback.
3. `FormyCore` writes `fieldsetRef.current.disabled = false` directly to the DOM.
4. No `useState` update, no parent or child re-render — pure DOM mutation.

### Why Not `useState`?

A state update (`setLoaded(true)`) would trigger a full re-render of `<Formy>` and all its children. The fieldset approach keeps it at zero rerenders, consistent with Formy's architecture.

---

## 5. Lightweight Mode (Render-Prop)

When `children` is a function (`typeof children === "function"`), Formy renders a plain `<Form>` (or `<form>` for non-action forms) directly — no `FormyCore`, no DOM restoration, no dynamic import.

Client-side validation (`validatorsRef`) still works in lightweight mode via `handleLightSubmit`.

---

## 6. Plain Mode

To allow developers to render ReactNode children (uncontrolled inputs) without the overhead of loading and executing the `FormyCore` DOM-manipulation engine, the `plainMode` optional boolean prop is available.

- **Usage:** When `<Formy plainMode={true}>` is passed, the dynamic import of `FormyCore` is completely bypassed. The form renders a plain `<form>` or `<Form>` wrapping the ReactNode children directly.
- **When to use:**
  - Forms that **do not use Server Actions** (e.g. pure client-side forms, search inputs, or forms submitting via standard client-side `fetch` handlers).
  - Since there is no server-side redirect or automatic page-refresh reset triggered by a Server Action, the DOM restoration and state synchronization features of `FormyCore` are not needed.
- **Benefits:**
  - Bypasses dynamic chunk loading.
  - Skips low-level DOM events interception and value restorations.
  - Allows using static uncontrolled inputs while still supporting Formy's client-side validation context (`validatorsRef`) on form submission.

---

## 7. SSR Decision Analysis: `ssr: true` vs `ssr: false`

During the implementation of dynamic loading, the choice between `ssr: true` (default) and `ssr: false` (client-only loading) for the `FormyCore` chunk was analyzed. Specifically, a hybrid approach where `ssr: false` is used, but a custom `loading` placeholder renders the form's `children` (inputs) directly:

```tsx
// Hypothetical fallback rendering children with ssr: false
<Suspense fallback={<FormySkeleton>{children}</FormySkeleton>}>
    <FormyCoreOriginal>
        {children}
    </FormyCoreOriginal>
</Suspense>
```

**Conclusion:** `ssr: true` is the **only architecturally sound and performant solution** for Formy's uncontrolled mode. The `ssr: false` approach (even with children in the skeleton) is highly inefficient due to the following four major issues.

### 7.1. DOM Swap & Unmount (DOM Reconstruction Overhead)

When the dynamic chunk of `FormyCore` finishes downloading, React is forced to transition from the fallback `<FormySkeleton>` to the actual `<FormyCoreOriginal>`.

- Because these are two different component types, React's reconciliation engine cannot reuse the existing DOM elements of the inputs.
- React **completely unmounts** the fallback (destroying the initial input DOM nodes) and **mounts new DOM nodes** for the loaded component.
- This causes a client-side layout reflow, visual flickering, and completely wipes out any input state or focus if the user managed to interact before the chunk loaded.

### 7.2. No Server-Side Rendering CPU Savings

One of the arguments for `ssr: false` is reducing the server CPU load. However, since the `children` (inputs) must be passed to `<FormySkeleton>` to keep them in the HTML, the server **still has to parse and render the entire input subtree** inside the fallback. Node.js performs the exact same amount of work, yielding zero server-side CPU optimizations.

### 7.3. Time-to-Interactive (TTI) Delay (No Preload)

- Under `ssr: true` (default), Next.js detects that `FormyCore` is rendered during SSR and automatically inserts a `<link rel="preload" href=".../formycore.js" as="script">` tag into the HTML `<head>`. The browser downloads the chunk in the background immediately in parallel with page loading. The form becomes interactive almost instantly.
- Under `ssr: false`, Next.js has no knowledge of the chunk during SSR. The browser receives the HTML and only initiates the request for `formycore.js` **after** the main JS bundle has finished loading and executing. The form remains disabled (`fieldset disabled`) for significantly longer, especially on slow network connections.

### 7.4. Autofill & Password Managers Compatibility

Browser password managers and autofill systems scan the DOM immediately upon the initial page paint. If the DOM nodes of the inputs are destroyed and recreated (DOM Swap) when `FormyCore` loads, autofilled credentials can be lost, or the manager might fail to detect the inputs altogether.

### 7.5. Conclusion

For Formy's uncontrolled mode, `ssr: true` is the only way to achieve seamless SEO, instant interactivity (TTI), and robust browser autofill support.

---

## 8. Internal State & Lifecycle Flags (`localState` in `FormyCore`)

To maintain its stateless parent behavior and avoid trigger-happy re-renders, `FormyCore` encapsulates mutable, non-rendering lifecycle flags and snapshots in a unified `localState` reference object:

- **`savedValues`**: Snapshot of all form field values (name → value) captured at submit time in `handleSubmit`. Fallback source for DOM restoration when the persist store is not connected.
- **`savedFiles`**: Snapshot of `File` objects per file-input name, captured in `handleChange`. Used to restore files via the `DataTransfer` API (as browser security policies block programmatic value assignment for file inputs).
- **`isRestoring`**: Guard flag set to `true` during DOM restoration. Prevents infinite event loops from synthetic events dispatched by `setNativeValue` / `setNativeChecked`.
- **`hasHydrated`**: Mount hydration flag. Prevents double-hydration side-effects under React 19's Strict Mode in development.
- **`persist`**: Fresh reference to the `FormyPersistAdapter` prop, allowing callbacks and effects to read the latest store adapter without requiring it in dependency arrays.

---

*Last updated: July 10, 2026*
