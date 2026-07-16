# formy-next — Technical Documentation

> Internal architecture, implementation decisions, and performance analysis.
> For usage guide and API reference, see [README.md](./README.md).

---

## 1. Zero-Rerender Architecture

```
Formy (orchestrator, "use client")        useActionState + <fieldset disabled> mount barrier
 ├─ FormyContext                          {state, isPending} — plain React context
 ├─ FormyModeContext                      {staticMode, clearOnSuccess}
 ├─ ErrorsContext                         external pub/sub store (createErrorsStore)
 │
 ├─ FormyInput (server-renderable)        Pure RSC (renders <input data-formy-input .../>)
 ├─ FormyRestoreEngine ("use client")     Event delegation restoration on form level
 │                                        (lazy loaded in staticMode)
 └─ FormyError ("use client")             useSyncExternalStore, keyed per-field
                                           → only the field whose error changed re-renders
```

### Client/Server Boundary

| File | Boundary |
| :--- | :--- |
| `Formy.tsx` | client |
| `components/FormyInput/index.tsx` | **server-renderable** (no directive) |
| `components/FormyRestoreEngine.tsx` | client (lazy-loaded via `next/dynamic`) |
| `components/FormyError.tsx` | client |
| `components/FormySubmit.tsx` | client |
| `components/FormySuccess.tsx` | client |
| `contexts/ErrorsContext.tsx` | client |
| `contexts/FormyContext.ts`, `FormyModeContext.ts` | server-renderable |
| `hooks/*.ts` | client |
| `utils/*.ts` | server-renderable |

`FormyInput` itself is the only "renders an input" component with no client directive — when composed from a Server Component parent (the pattern the docs push), this wrapper function never ships to the browser. Everything that handles value restoration and error displays (`FormyRestoreEngine`, `FormyError`) are client components.

### Decoupled Component Architecture

Formy achieves zero unnecessary re-renders via a decoupled component architecture:

1. **`Formy` (Orchestrator):** Manages `useActionState`, initializes the `ErrorsStore`, and holds the `validators` ref. Provides the contexts and delegates rendering to `FormContent`.
2. **`FormContent` (Boundary & Validation):** Manages form submission, performs client-side validation on submit, and coordinates the fieldset barrier and form element rendering.
3. **`FieldsetBarrier` (Interactive Blocker):** Handles the `<fieldset disabled>` wrapper. Once the client hydrated and the restore engine mounts, it enables the form by setting `fieldset.disabled = false` inside a `useLayoutEffect`.
4. **`FormElement` (Routing & Lazy Engine):** Selects between Next.js `<Form>` and native `<form>` depending on the action type. Dynamically imports and mounts `FormyRestoreEngine`.
5. **`FormyInput` (Server Component):** A pure React Server Component (RSC) that renders a native `<input>` with a `data-formy-input` attribute. It has zero client JS and does not trigger component updates.
6. **`FormyError` (Local State observer):** Subscribes directly to the external `ErrorsStore` via `useSyncExternalStore`. Real-time validation is handled locally inside each error field.

Server errors propagate through the `ErrorsStore` (an external pub/sub observer created via `createErrorsStore`), not through React state in the parent `Formy`. This means `FormyError` components receive updates without triggering any parent or sibling re-renders.

**Result:** Typing in one input or receiving a server validation error *never* triggers a re-render of the parent `<Formy>` component or sibling inputs. Only the specific `<FormyError>` for the affected field re-renders.

---

## 2. Value Restoration & Event Delegation: `FormyRestoreEngine`

### The Problem

React 19 automatically calls `form.reset()` after every Server Action completes (including errors). This wipes all user-typed values. For inputs that are React Server Components (static HTML with no `useState` or client hooks), there is no React state to restore from.

### The Mechanism

Value tracking and restoration are fully centralized in the dynamically loaded `FormyRestoreEngine` component:

1. **Event Delegation:** Rather than mounting listeners on every individual input, `FormyRestoreEngine` attaches single `input` and `change` event listeners to the parent `<form>` element.
2. **Input Capture:** The engine filters events to only process elements having the `data-formy-input` attribute (namely `<FormyInput>` elements):
   - Text inputs, textareas, selects: captures `.value`.
   - Checkboxes: captures `.checked` as `"true"` / `"false"`.
   - Radios: captures `.value` of the checked radio button.
   These captured values are stored in a local `useRef<Map<string, string>>` map.
3. **Restoration:** A `useLayoutEffect([state])` fires when the Server Action state changes (i.e. action completes). It directly updates the DOM element properties (`el.value` or `el.checked`) by looking them up in `form.elements.namedItem(name)`. This happens synchronously before the browser paints, preventing any visual flicker.
4. **Radio Group Resolution:** When resolving radio groups where multiple buttons share the same name, `form.elements.namedItem(name)` returns a `RadioNodeList`. The engine iterates through the list and checks only the node whose value matches the saved selection.

### Success Handling

On success (`"data" in state`) with `clearOnSuccess = true` (default), the saved values map is cleared, allowing the form to stay reset. With `clearOnSuccess = false`, values are restored exactly as they are on error.

---

## 3. The Fieldset Barrier: `FieldsetBarrier`

To prevent the user from typing into inputs before the value tracking listeners are registered (which would lead to value loss if a server error occurs before the chunk is loaded), Formy uses a native HTML fieldset barrier:

1. **Server Paint:** The form elements are rendered inside a `<fieldset disabled style={{ display: "contents" }}>`.
2. **Hydration & Chunk Load:** The inputs are locked. Once the main app hydates and the dynamically imported `FormyRestoreEngine` is loaded and mounted:
3. **Activation:** The `useLayoutEffect` in `FieldsetBarrier` fires and mutates the DOM directly:
   ```ts
   if (fieldsetRef.current) {
       fieldsetRef.current.disabled = false;
   }
   ```
   No React state update (`useState`) is triggered, keeping parent and child components at zero unnecessary re-renders.

---

## 4. Solving the Null Form Ref Issue

In React, child `useLayoutEffect` hooks execute *before* parent ref assignments are completed during the initial mount. 

If the restoration engine is mounted synchronously, `formRef.current` is still `null` when the engine's layout effects execute, making it impossible to attach listeners or read form elements.

### The Solution

We solve this timing issue by structuring `FormContent` as the ref owner:

1. **Ref Initialization:** The `fieldsetRef` and `formRef` refs are declared and managed inside `FormContent.tsx`.
2. **First Render:** `FormElement` renders the `<form ref={formRef}>` (or `<Form ref={formRef}>`). Because `FormyRestoreEngine` is loaded via `next/dynamic`, its chunk loading introduces an asynchronous boundary.
3. **Mounting Order:** React mounts the `<form>` element first and assigns `formRef.current`.
4. **Engine Mount:** By the time the `FormyRestoreEngine` component code is loaded and its `useEffect` or `useLayoutEffect` hooks execute, `formRef.current` is guaranteed to be fully populated with the DOM node of the form.

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
- The `<FieldsetBarrier>` bypasses the disabled fieldset wrapping, rendering children directly.
- The `FormyRestoreEngine` chunk is **never downloaded or loaded**, keeping the bundle size minimal.
- Value restoration is skipped entirely.
- Client-side validation (`validators`) still works via `handleSubmit` on form submission.

**When to use:** For forms without Server Actions (e.g. search forms or simple client-side page transitions) where value preservation on roundtrip is not needed but client-side validation is still desired.

---

## 7. SSR Considerations

`FormyRestoreEngine` is loaded with `next/dynamic` default (`ssr: true`). Next.js detects that `FormyRestoreEngine` is rendered during SSR and automatically preloads it:
- Preload tags (`<link rel="preload" as="script">`) are inserted into the HTML `<head>`.
- The chunk downloads in parallel with the main bundle, making the form interactive almost instantly without waiting for subsequent client-side JS evaluation.

---

## 8. Third-party UI Component Compatibility (Shadcn / Radix)

### Three tiers of form children

| Tier | Example | Formy restoration? |
| :--- | :--- | :--- |
| **`<FormyInput>`** | `<FormyInput name="email" />` | ✅ Full — `FormyRestoreEngine` event delegation |
| **Plain `<input>`** | `<input name="email" />` inside `<Formy>` | ❌ No restoration (missing `data-formy-input` attribute) |
| **Shadcn / Radix components** | `<Select>`, `<Checkbox>`, `<Switch>` | ⚠️ Use `useFormyErrors` for error/validation wiring |

### Custom Component Integration

Use `useFormyErrors(name)` to access `clearFieldError`. Call it on `onValueChange` or equivalent interaction callback to dismiss validation errors when the user interacts with the UI widget. Render a sibling `<FormyError field={name} />` for the error display.

---

## 9. Architectural Evaluation & Verdict

### 9.1 RSC Composition and Execution
- `FormyInput` itself has no `"use client"` directive — composed from a Server Component parent, this component genuinely renders as a plain, static HTML `<input>` server-side and does not execute any Javascript on the client.
- However, value restoration relies on `FormyRestoreEngine` (dynamically loaded on the client in `staticMode`) and `FormyError` (client component subscribing to the error store).
- So while individual inputs are fully server-generated static elements with no client JS attached directly to them, the form coordinates restoration on the client via a single, dynamically imported event delegation engine (`FormyRestoreEngine`). What Formy actually avoids is turning the **whole form** or every single input into a client component. Instead of big client bundles, you get a clean separation: pure server-rendered inputs and a single client restoration overlay.

### 9.2 Bundle Weight Analysis
- The actual client-side surface area is small: `FormyRestoreEngine` is 3.3KB source, `FormyError` 2KB, `Formy.tsx` 2.7KB — a few KB total pre-minification, realistically under 1–2KB gzipped combined. That's the entire cost being avoided versus pulling in a full form-management library with its own subscribe/watch engine and resolver adapters.
- In **default mode**, nothing is truly removed from total bytes transferred — `next/dynamic` code-splits `FormyRestoreEngine` into its own chunk that's preloaded and fetched in parallel with the main bundle. That's a load-order / TTI win (form becomes interactive sooner, no main-bundle bloat), **not** a reduction in total KB downloaded.
- In **`staticMode={false}`**, the saving is real and literal: that chunk is never requested, so those bytes are actually never sent — not just deferred.

---

## 10. Prior Art & Comparison with Alternatives

The underlying bug Formy targets is not invented — it's a confirmed, tracked React 19 behavior:
- [react/react#31649](https://github.com/react/react/issues/31649) — "Submitting a `<form>` with an `action` will clear the input values"
- [react/react#29034](https://github.com/react/react/issues/29034) — request to let apps opt out of the auto-reset entirely (still open)

No npm package solves it the way Formy does, but several sit in the same space:

| Package | How it handles it | Gap vs. Formy |
| :--- | :--- | :--- |
| **`@conform-to/react`** ("Conform") | Built for progressive enhancement with Server Actions, feeds `lastResult` back into `defaultValue` on inputs | Per the maintainer's own explanation ([discussion #1111](https://github.com/edmundhung/conform/discussions/1111)): React 19's auto-reset fires *before* Conform can reapply `defaultValue`, so **the exact bug Formy targets is still an open, unresolved limitation in Conform**. Formy sidesteps this because it restores via a `useLayoutEffect` DOM mutation that runs *after* React's own reset, not via `defaultValue`/React state. |
| **`react-hook-form` / `@tanstack/react-form`** | Fully controlled, client-hydrated — values live in the library's own state, so there's nothing for React 19 to "reset" | Requires full client hydration of every field, heavy bundle cost, and makes RSC composition impossible. |
| **`next-safe-action` / `zsa`** | Type-safe wrappers/validation pipelines around Server Actions | Do not address value preservation at all — typically paired *with* client-side form libraries. |

The common community answer today is a hand-rolled `defaultValue={actionState.payload?.get("field")}` pattern — not a library. Formy's combination of RSC-composed inputs, post-reset DOM restoration via event delegation, a per-field external store for zero-rerender errors, and an optional `staticMode` that skips the client chunk entirely offers a unique 0-dependency solution.

---

*Last updated: July 17, 2026*
