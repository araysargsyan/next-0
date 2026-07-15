# formy-next — Technical Documentation

> Internal architecture, implementation decisions, and performance analysis.
> For usage guide and API reference, see [README.md](./README.md).

---

## 1. Zero-Rerender Architecture

Formy achieves zero unnecessary re-renders via a decoupled component architecture:

1. **`Formy` (Orchestrator):** Manages `useActionState`, initializes the `ErrorsStore`, and holds the `validators`. Renders a single `<fieldset disabled>` barrier that is enabled synchronously on mount via `useEffect`.
2. **`FormyInput` → `DynamicInput` → `RestoreInputValue` (DOM Layer):** Each input manages its own value snapshot and DOM restoration in isolation. `RestoreInputValue` is lazy-loaded per-input via `next/dynamic`.
3. **`FormyError` (Local State):** Subscribes directly to an external `ErrorsStore` via `useSyncExternalStore` and handles real-time client validation locally via its own `useState`.

Server errors propagate through the `ErrorsStore` (an external observer created via `createErrorsStore`), not through React state in the parent `Formy`. This means `FormyError` components receive updates without triggering any parent or sibling re-renders.

**Result:** Typing in one input or receiving a server validation error *never* triggers a re-render of the parent `<Formy>` component or sibling inputs. Only the specific `<FormyError>` for the affected field re-renders.

---

## 2. Value Restoration: `RestoreInputValue`

### The Problem

React 19 automatically calls `form.reset()` after every Server Action completes (including errors). This wipes all user-typed values. For inputs that are React Server Components (static HTML with no `useState`), there is no React state to restore from.

### The Mechanism

`RestoreInputValue` is a `'use client'` component that wraps the native `<input>` element:

1. **Ref attachment:** Uses `cloneElement(children, { ref: inputRef, onChange: handleChange })` to attach a `ref` to the underlying `<input>` without requiring the parent (which may be an RSC) to pass a `ref`.
2. **Value snapshot:** On every `onChange`, stores the current value in a local `useRef<string | null>`:
   - Text inputs: stores `target.value`
   - Checkboxes: stores `"true"` / `"false"`
   - Radios: stores `target.value` only when `target.checked === true`
3. **Restoration:** A `useLayoutEffect([state])` fires when the Server Action state changes (i.e., action completes). It restores `el.value` or `el.checked` directly from the ref — before the browser paints, preventing any visible flash.

### Restoration Timing

The form resets **after** action completion (when `isPending` transitions `true → false`), not during. React 19 calls `requestFormReset(form)` as part of the post-action reconciliation. `useLayoutEffect` runs synchronously after reconciliation and before paint, so restoration happens at exactly the right moment with no visual flicker.

### Success Handling

On success (`"data" in state`) with `clearOnSuccess = true` (default), `value.current` is set to `null` — the form stays reset. With `clearOnSuccess = false`, the value is restored as on error.

### Why `cloneElement` Instead of Global DOM Query

Alternatives like `document.getElementById` would require every input to have a manually assigned unique `id`, adding boilerplate and risking ID collisions in duplicate-form scenarios. `cloneElement` is cleaner — the ref is attached locally and automatically garbage-collected when the component unmounts.

---

## 3. Dynamic Loading: `DynamicInput`

`RestoreInputValue` is loaded lazily via `next/dynamic`:

```tsx
const RestoreInputValue = dynamic(() =>
    import("./RestoreInputValue").then(m => ({ default: m.RestoreInputValue }))
);
```

**Why:** `RestoreInputValue` contains DOM manipulation logic that is only needed when the form uses a Server Action (i.e., when value restoration is needed). When `staticMode={false}`, this chunk is never downloaded.

**Branching logic in `DynamicInput`:**

```tsx
if (!staticMode) {
    return children;
}
return (
    <RestoreInputValue type={type} onChange={onChange}>
        {children}
    </RestoreInputValue>
);
```

- **`staticMode = true` (default):** `RestoreInputValue` is dynamically loaded and wraps the server-rendered `<input>` (passed as `children`).
- **`staticMode = false`:** The server-rendered `<input>` is returned directly — zero dynamic chunk loading.

`staticMode` is consumed from `FormyModeContext`, which is set by `<Formy staticMode={...}>`.

---

## 4. Zero-Rerender Loading Barrier

`Formy.tsx` wraps all form content in a natively disabled `<fieldset>`:

```tsx
<fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
    {/* form content */}
</fieldset>
```

### Lifecycle

1. Server render + initial client paint: fieldset is `disabled` → all inputs are non-interactive.
2. `Formy` mounts on the client → `useEffect` fires → `fieldsetRef.current.disabled = false`.
3. No `useState` update, no parent or child re-render — pure DOM mutation.

### Why Not `useState`?

A state update (`setLoaded(true)`) would trigger a full re-render of `<Formy>` and all its children. The fieldset approach keeps it at zero rerenders, consistent with Formy's architecture.

---

## 5. Error Store: Zero-Rerender Error Propagation

### `createErrorsStore`

A minimal pub/sub store created once per `<Formy>` instance (via `useState(() => createErrorsStore(initial))`):

```ts
interface ErrorsStore {
    getSnapshot: () => Record<string, string> | null;
    setErrors: (next: Record<string, string> | null) => void;
    subscribe: (listener: () => void) => () => void;
}
```

### `useFormyErrorStore`

Manages the lifecycle of the store inside `Formy`:
- Derives the normalized errors object from `state` and `isPending` via `useMemo`
- Propagates changes to the store via `useEffect([errors, errorsStore])`
- Exposes `clearFieldError(name)` — clears the named field error, or the global error if one is active

### `useFormyErrors(key)`

Consumed by `FormyError` and any custom component using `useFormyErrors`:
- Subscribes to the store via `useSyncExternalStore`
- The `getSnapshot` function is scoped to a **specific key**: `store.getSnapshot()?.[key] || null`
- React compares the returned value on each store notification and **skips re-renders** if this specific key's value did not change

**Result:** 100 `<FormyError>` components can share one store — only the one whose field changed re-renders.

---

## 6. Non-Static Mode

When `<Formy staticMode={false}>` is set:
- `DynamicInput` returns the server-rendered `<input>` directly — no `RestoreInputValue` chunk is downloaded.
- Value restoration is skipped entirely.
- Client-side validation (`validators`) still works via `handleSubmit` on form submission.

**When to use:** When you want to render static JSX elements (ReactNode children) instead of writing a controlled render-prop function, but you do not need the dynamic client-side value restoration scripts (e.g. for simple search forms, filter selectors, or client-side fetch handlers where value loss on submit is acceptable).

---

## 7. Lightweight Mode (Render-prop)

When `children` is a function (`typeof children === "function"`), the form is in controlled/render-prop mode. In this case:
- `FormyInput` with `value` + `onChange` manages its own state via React
- `RestoreInputValue` is still loaded (to handle `onChange` → `clearFieldError` + `runFieldValidation` wiring)
- DOM restoration via `useLayoutEffect` is effectively a no-op if the value is controlled — React re-renders with the correct state value anyway

Client-side validation still works in this mode via `handleSubmit`.

---

## 8. SSR Considerations

`RestoreInputValue` is loaded with `next/dynamic` default (`ssr: true`). This is the only architecturally sound choice:

### Why `ssr: false` Would Be Wrong

1. **DOM Swap:** Under `ssr: false`, React would unmount the fallback `<input>` DOM nodes and remount new ones when the chunk loads — destroying any in-progress autofill or user input.
2. **No CPU savings:** The `<input>` children still need to be rendered server-side inside a fallback skeleton — no server work is saved.
3. **TTI delay:** Without SSR, Next.js does not insert `<link rel="preload">` for the chunk. The browser only fetches it after the main JS bundle executes — significantly delaying interactivity on slow connections.
4. **Autofill compatibility:** DOM node recreation breaks browser password managers that scan the initial DOM paint.

### Why `ssr: true` Works

Next.js detects that `RestoreInputValue` is rendered during SSR and automatically injects `<link rel="preload" href=".../RestoreInputValue.js" as="script">` into the HTML `<head>`. The chunk downloads in parallel with page loading — the form becomes interactive almost instantly.

---

## 9. Third-party UI Component Compatibility (Shadcn / Radix)

### Three tiers of form children

| Tier | Example | Formy restoration? |
| :--- | :--- | :--- |
| **`<FormyInput>`** | `<FormyInput name="email" />` | ✅ Full — `RestoreInputValue` |
| **Plain `<input>`** | `<input name="email" />` inside `<Formy>` | ❌ No ref, no restoration |
| **Shadcn / Radix components** | `<Select>`, `<Checkbox>`, `<Switch>` | ⚠️ Use `useFormyErrors` for error wiring |

### Why Shadcn / Radix always require `'use client'`

Radix and Shadcn components always ship with `'use client'` for two reasons:
1. **Interactivity** — they manage open/close state, animations, and pointer events.
2. **Accessibility** — keyboard navigation and ARIA attributes are driven by JavaScript event handlers.

### How to Integrate with Formy

Use `useFormyErrors(name)` to access `clearFieldError`. Call it on `onValueChange` to dismiss errors when the user interacts. Render a sibling `<FormyError field={name} />` for the error display:

```tsx
'use client'
import { useFormyErrors } from "formy-next";

export function CountrySelect({ name }: { name: string }) {
    const { clearFieldError } = useFormyErrors(name);

    return (
        <Select name={name} onValueChange={() => clearFieldError?.(name)}>
            ...
        </Select>
    );
}
```

This component can be dropped directly into any `<Formy>` form without additional wiring.

---

*Last updated: July 12, 2026*
