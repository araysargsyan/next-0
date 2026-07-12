# Formy v7: State Management & DOM Sync — Session Cheatsheet

> **Date:** July 5, 2026
> **Scope:** Formy component ecosystem — checkbox/radio support, persist bridge, client-side validation, TypeScript cleanup, ESLint compliance, lifecycle logging, folder restructure, stale error flash fix, validator re-registration fix, file input clearing fix
> **Status:** Core implementation complete, pending items listed below

---

## 1. What is Formy?

A zero-hydration Server Action form wrapper for Next.js 16 + React 19. Solves the React 19 problem where `form.reset()` fires automatically after every Server Action completion (even on validation errors), wiping user-typed values.

---

## 2. File Structure

```
src/components/UI/Formy/
├── formy.tsx                        # Main component (client boundary)
├── index.ts                         # Public API — all exports
├── types.ts                         # FormyActionState, FormyProps, StrictFormyState,
│                                    #   FormyStoreSlice, FormyPersistAdapter, UseStoreHook
├── README.md
├── components/
│   ├── FormyError.tsx               # Field/global error display + client validation registration
│   ├── FormySubmit.tsx              # Submit button (useFormStatus from react-dom)
│   └── FormySuccess.tsx             # Conditional success content
├── contexts/
│   ├── FormyContext.ts              # state + isPending + registerValidator
│   └── FormyPersistContext.tsx      # FormyPersistHook context (store-agnostic adapter)
├── hooks/
│   ├── useFormyActionState.ts       # Wraps useActionState; handles fn vs URL action
│   └── usePersistedForm.ts          # Hook: reads/writes one form's values from any store
└── utils/
    ├── createPersistBridge.tsx      # Factory: binds usePersistedForm to a store, returns <Provider>
    └── domHelpers.ts                # setNativeValue, setNativeChecked
```

**Related files:**
- `src/lib/store/formStore.ts` — Vanilla Zustand store (`createStore`)
- `src/components/Providers/FormStoreProvider.tsx` — SSR-safe Zustand provider + `createPersistBridge` wiring

---

## 3. Key Architectural Decisions

1. **`setNativeValue` / `setNativeChecked` over direct property mutation** — React keeps Virtual DOM in sync.
2. **Zustand vanilla store (`createStore`) over React hook store (`create`)** — SSR safety in Next.js App Router.
3. **`useState` lazy init in `FormStoreProvider`** — React 19 concurrent rendering safety + lint compliance.
4. **`useFormStatus` in `FormySubmit`** — Makes the submit button universally reusable outside `<Formy>`.
5. **`isRestoring` guard + `didTransitionEnd` pattern** — Prevents infinite loops from `setNativeValue` dispatching `"input"` events that trigger Zustand updates.
6. **`createPersistBridge` factory** — Formy is 100% store-agnostic. Can be wired to Redux, Jotai, MobX, or custom context.
7. **`FormyActionState | null` for `resolvedState`** — Avoids unsafe `as Awaited<State>` casts by splitting concerns: context gets merged error state, `children` render-prop gets the original clean `state`.
8. **Render-phase state adjustment for `clearOnSuccess`** — `setClientErrors({})` called during render (not in `useEffect`) per React docs best practice.
9. **`instanceof` narrowing over `as` casts in event handlers** — Eliminates TypeScript unsafe casts while being semantically correct.
10. **`usePersistedForm.bind(null, useStoreHook)` in `createPersistBridge`** — Eliminates wrapper hook, ESLint-compliant (`.bind()` is not a hook call), passes bound hook as context value.
11. **Local validation state in `FormyError` (v8.0)** — `clientError` and `isEdited` states live inside each `FormyError` instance, not in the parent `Formy`. `registerValidator` accepts `setErrorFn` and `onEditFn` callbacks. Parent calls them directly via `validators.current` ref on input/submit — zero parent re-renders triggered by validation or field editing.
12. **Discriminated union without success field for FormyActionState** (v9.0) — Eliminates dual-state boolean ambiguity by defining the action output as either having `error` or `data` property.
13. **`FormyInput` component for controlled / lightweight mode** (v11.0) — Implemented `<FormyInput>` to encapsulate native `<input>` elements, register validators, and handle automatic error clearing on input/change via `clearFieldError` in context. This avoids duplicating event listening logic at the form level.

---

## 4. Problems Solved — History

### 4.1. Native DOM Sync (`setNativeValue`)

**Problem:** Direct `input.value = "..."` bypasses React's internal tracking.

**Solution:** `setNativeValue()` reads the native browser setter via `Object.getOwnPropertyDescriptor(prototype, "value").set`, calls it and dispatches a bubbling `"input"` event. React intercepts this and keeps Virtual DOM in sync.

### 4.2. Checkbox & Radio DOM Sync (`setNativeChecked`)

**Problem:** `setNativeValue` has no effect on checkboxes and radios — they use `.checked` not `.value`.

**Solution:** `setNativeChecked()` — same pattern as `setNativeValue` but via `Object.getOwnPropertyDescriptor(prototype, "checked").set` + dispatches a bubbling `"change"` event.

### 4.3. Checkbox Support in `handleSubmit`

**Problem:** `new FormData(form)` does NOT include unchecked checkboxes at all (HTML spec behavior). On error restore, we'd never know a checkbox existed and should be unchecked.

**Solution:** After building `FormData`, query all `input[type="checkbox"]` and append `"false"` for any that are missing from `FormData`:
```typescript
formRef.current.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    const cb = el as HTMLInputElement;
    if (cb.name && !formData.has(cb.name)) {
        formData.append(cb.name, "false");
    }
});
```

### 4.4. Checkbox & Radio Persist Sync (`onChange` handler)

**Problem:** `handleInput` (triggered by `"input"` event) doesn't fire for checkboxes/radios — they use `"change"`.

**Solution:** Added `handleChange` handler on `<Form onChange={handleChange}>`:
- Checkbox: reads `.checked`, stores `"true"` / `"false"` via `persist.setValue`
- Radio: stores `.value` only when `.checked === true`
- Select: reads `.value` (select also fires `"change"` not `"input"`)
- File: snapshots `FileList` into `savedFiles` ref

**Guard:** `handleInput` skips checkboxes and radios (`type !== "checkbox" && type !== "radio"`) to avoid double-processing.

### 4.5. Persist Bridge Architecture

**Problem:** Original implementation was tightly coupled to Zustand.

**Solution:** Formy is now completely store-agnostic:
1. `FormyPersistContext` holds a `FormyPersistHook = (formId: string) => FormyPersistAdapter`
2. `hooks/usePersistedForm.ts` — standalone hook `(useStoreHook, formId) => FormyPersistAdapter`
3. `utils/createPersistBridge.tsx` — factory that accepts any store hook and returns a `<FormyPersistBridge>` Provider. Uses `usePersistedForm.bind(null, useStoreHook)` to bind the store without a wrapper hook.
4. `FormStoreProvider` wires Zustand + bridge together at the app level

### 4.6. Client-side Validation

**What:** Real-time field validation on input + final validation on submit.

**Architecture:**
- `FormyContext` now exposes `registerValidator` in addition to `state` and `isPending`
- `FormyError` accepts a `validate` prop: `(value: string) => string | null`
- On mount, `FormyError` calls `registerValidator(field, validate)` and returns cleanup
- `runFieldValidation(name, value)` is called from `handleInput`, `handleChange`, and `handleSubmit`
- On submit: if client errors exist → `e.preventDefault()` + `setClientErrors(errors)`, Server Action is NOT called
- `clientErrors` are merged into `resolvedState` (displayed by `FormyError` alongside server errors)

> **Important:** `validate` functions must be defined in a Client Component file (or a `'use client'` module). They **cannot** be passed as props from a Server Component.

### 4.7. Global Zustand `FormStore`

**Store shape:** `{ forms: Record<formId, Record<fieldName, fieldValue>> }`

**Actions:** `setFormValue(formId, name, value)`, `clearForm(formId)`

**SSR safety:** Uses `createStore` from `zustand/vanilla` (not `create` — avoids cross-request state leakage in App Router).

### 4.8. Infinite Loop Fix

**Two guards:**
1. `isRestoring` ref: set `true` before DOM restoration, `false` after. Both `handleInput` and `handleChange` return early when `isRestoring` is `true`.
2. `isActionEnded` flag in `localState` ref: armed when `isPending` becomes `true`, and consumed to trigger DOM restoration when `isPending` returns to `false`.

### 4.9. TypeScript Compliance Fixes (July 5)

- `resolvedState`: removed `as Awaited<State>` cast. Now typed explicitly as `FormyActionState | null` via `useMemo`. Children receive original `state` (clean `Awaited<State> | null` type).
- `handleInput` / `handleChange`: replaced `as HTMLInputElement` unsafe casts with `instanceof` narrowing guards.
- `stateError`: extracted via `"error" in state` guard before accessing `.error` to satisfy TypeScript's union type checking.

### 4.10. ESLint Compliance Fixes (July 5)

- `registerValidator` and `runFieldValidation` `useCallback` deps: added `setClientErrors`.
- `resolvedState` wrapped in `useMemo` to fix `react-hooks/exhaustive-deps`.
- `setClientErrors({})` removed from `useEffect` — moved to render-phase state adjustment.
- `isRestoring.current` removed from render-body `console.log` (cannot access refs during render).
- `restoreFromValues` wrapped in `useCallback([props.id])` to satisfy `exhaustive-deps` for `useEffect`.
- `createPersistBridge` — uses `.bind()` instead of inline arrow callback or wrapper hook to satisfy `rules-of-hooks`.

### 4.11. Folder Restructure (July 5)

Formy was refactored from a flat folder into a clean modular structure:

| Before | After |
|:---|:---|
| `FormyContext.ts` (root) | `contexts/FormyContext.ts` |
| `FormyPersistContext.tsx` (root) | `contexts/FormyPersistContext.tsx` |
| `FormyError.tsx` (root) | `components/FormyError.tsx` |
| `FormySubmit.tsx` (root) | `components/FormySubmit.tsx` |
| `FormySuccess.tsx` (root) | `components/FormySuccess.tsx` |
| `useFormyActionState.ts` (root) | `hooks/useFormyActionState.ts` |
| `createPersistBridge.tsx` (root) | `utils/createPersistBridge.tsx` + `hooks/usePersistedForm.ts` |
| `index.tsx` | deleted (superseded by `index.ts`) |

All old root re-export stubs were deleted. `index.ts` exports directly from subfolders.

### 4.12. Lifecycle Logging

All key events now have color-coded `console.log` with `[Formy: <id>]` prefix:

| Color | Event |
|:---|:---|
| 🔵 Cyan | Every render (state snapshot) |
| 🟢 Green | Mount hydration, success clear/restore |
| 🟠 Orange | Input, change, checkbox, radio, select, file events |
| 🟣 Purple | Field validation result (PASSED/FAILED) |
| 🔴 Hot pink | Form submit |
| 🔴 Red | Client validation failed |
| 🔵 Teal | `restoreFromValues` DOM restoration |

> **Note:** In React Strict Mode (dev only), the render body runs twice per render cycle. Double render logs are a Strict Mode artifact, not a bug.

### 4.13. FormyActionState Simplification & Prop Cleanup (July 8, 2026)

**Problem:** The `success` boolean field was redundant and created ambiguity about action results. Additionally, unused props (`submitLabel` / `loadingLabel`) cluttered the `<Formy>` component API.

**Solution:** Removed the `success` field from `FormyActionState` and migrated all success checking logic to `"data" in state` pattern. The unused `submitLabel` and `loadingLabel` props were fully removed from the `<Formy>` component props interface while keeping explicit `<FormySubmit>` support intact.

---

## 5. What FormyContext Is Still Needed For

`FormyContext` **cannot be replaced** by `useFormStatus`. The native hook only provides `pending`, `data`, `method`, `action` — not the returned Server Action state.

Components that depend on `FormyContext`:
- `FormyError` — reads `state.error` + calls `registerValidator`
- `FormySuccess` — reads `state.data`
- Render-prop `children` — receives `state, isPending`

---

## 6. Pending Items (TODO)

### 6.1. File Input Limitation (Known, not critical)
Browsers block programmatic setting of `<input type="file">` values for security. File inputs always reset on validation error.
- **Current mitigation:** `savedFiles` ref captures the `FileList` on change and attempts restore via `DataTransfer` API.
- **Limitation:** `DataTransfer`-based restore is not supported in all environments.

### 6.2. Custom UI Component Compatibility
Third-party UI libraries (Radix, Shadcn) hide native inputs. `querySelectorAll("input")` + `setNativeValue` won't reach them.
- **When:** When such components are introduced into forms.

### 6.3. Live Validation UX Improvements
Validation fires on every keystroke (real-time). No debounce is applied yet.
- **When:** Gradual, as UX requirements grow.

---

## 7. Current Form IDs in Use

2. User edits a field, submits again → this time the error is **field-specific** (e.g. email error).
3. On screen, for roughly a second, the **old global error re-appears**, then disappears, and only *after* that the **new field error** shows up on the email input.

The same glitch happens in reverse — field error first, then a global error on the next submit — the stale one flashes before being replaced.

**Suspected cause (per user):**
In a previous update, a handler was added that clears the currently-displayed error once the user starts typing a new value into an input. The glitch is suspected to originate from this "clear error on input" handling.

**Status:** Resolved. The reset of `editedFields` was moved from the start of the submission (when `resolvedIsPending` becomes `true`) to the end of the submission (when `resolvedIsPending` transitions from `true` to `false`). This ensures that the filtered stale errors remain hidden while the Server Action is running.

### 6.5. Codebase Walkthrough & Hooks Discussion (RESOLVED, July 8, 2026)
- **Symptom/Goal:** Detailed review of Formy's internal hook design to align on the lifecycle and state management.
- **Status:** Resolved. All individual refs (`prevIsPending`, `savedValuesRef`, `savedFilesRef`, `isRestoringRef`, `hasHydrated`, `persistRef`) were consolidated into a single `localState` ref object with clear JSDoc explanations for each field.
- **Action State Separation:** The transition tracking and DOM restoration effects were moved into `FormyCore`'s action state handler, registered into a parent-owned `onActionChangeRef` callback. This prevents `FormyCore` from re-rendering on parent `state` / `isPending` updates.

### 6.6. Architectural Scope Issue: FormyCore is RSC-Only by Design (July 8, 2026)

**Discovery:** During session review, we identified that **the entire FormyCore DOM manipulation layer exists exclusively to serve the RSC/uncontrolled input scenario**. This is not a limitation — it is the fundamental architectural purpose of Formy. However, it raises an important scope concern.

**The Core Insight:**

Formy's main goal is to keep `<input>` elements as **React Server Components (RSC)** — zero JS hydration for field layouts. The `<Formy>` client boundary wraps the form, while children (inputs, labels, layout divs) remain server-rendered static HTML.

Because RSC inputs are **uncontrolled** (no `useState`, no `onChange` from React), the only way to restore their values after React 19's automatic `form.reset()` + RSC refresh is **direct DOM manipulation**. This is why `FormyCore` exists with its full DOM machinery.

**The Problem with Controlled Inputs:**

If a consumer creates a `'use client'` form (e.g., `LoginForm` with `useState` for each input) and wraps it in `<Formy>`, the following FormyCore internals become **dead weight** — code that runs but serves no purpose:

| FormyCore Internals | Purpose (RSC scenario) | Needed for `useState` inputs? |
|:---|:---|:---|
| `savedValuesRef` | Snapshot DOM values before reset | ❌ Values live in React state |
| `formRef.querySelectorAll("input")` | Discover uncontrolled inputs in DOM | ❌ React already tracks them |
| `setNativeValue` / `setNativeChecked` | Restore values via native DOM setters | ❌ `setValue(x)` triggers re-render |
| `isRestoringRef` guard | Prevent infinite loops during DOM restoration | ❌ No DOM restoration occurs |
| `handleInput` / `handleChange` interception | Capture input from uncontrolled elements | ❌ `onChange` already manages state |
| `restoreFromValues` useEffect | DOM restoration on `isPending: true→false` | ❌ Just `setState(savedValue)` |
| `prevIsPending` ref | Detect action completion transition | ❌ Not needed without DOM restoration |

With controlled inputs, the entire restoration logic collapses to a single line: `setEmail(savedEmail)`.

**Why alternatives to `setNativeValue` don't work for RSC inputs:**

1. **`defaultValue` via server response** — `useActionState` is a client hook; RSC inputs cannot access it. And `children` is opaque `ReactNode` — the client `<Formy>` parent cannot inject props into RSC children.
2. **`onSubmit` + `e.preventDefault()`** — Prevents `form.reset()` but not the RSC refresh, which re-renders inputs with original `defaultValue`.
3. **React Context** — RSC cannot consume context (`useContext` is client-only).
4. **`useOptimistic` / render props** — Both require inputs to become client components, defeating the purpose.

**Conclusion:** `setNativeValue` / `setNativeChecked` via native property descriptors is the **only viable best practice** for restoring uncontrolled RSC input values. All alternatives collapse into "make inputs client-side," which contradicts Formy's core architectural goal.

**Resolution (July 8, 2026):** We implemented **Option 2 (Lightweight mode)** with dynamic importing:
1. **Dynamic FormyCore Loading:** In `Formy.tsx`, we inspect the `children` type.
   - If `children` is a function (controlled/render-prop mode) → we render a lightweight `<form>` or `<Form>` directly. The heavy DOM restoration logic and helpers are **not imported or loaded** at all.
   - If `children` is a `ReactNode` (RSC/uncontrolled mode) → we dynamically import `FormyCore` (using `next/dynamic` with `ssr: true` default). All DOM-handling refs, hooks, and effects are encapsulated inside `FormyCore.tsx`.
2. **Zero-Rerender Loading Barrier:** During the dynamic loading of `FormyCore`, the form contents are wrapped in `<fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>` *inside* `FormyCore`.
   - On the server and initial client paint, the fieldset is natively `disabled`.
   - When the `FormyCore` chunk finishes loading and mounts on the client, it directly sets `fieldsetRef.current.disabled = false` inside its mount effect.
   - This avoids any React state updates (`useState`) or parent component re-renders, adhering fully to the **Zero-Rerender** architecture of Formy.

**Status:** Resolved. Full documentation: `../../src/libs/formy/TECHNICAL.md`

### 6.7. Testing Dynamic Loading Changes (HIGH PRIORITY)

Current dynamic loading implementation requires manual and automated verification before moving forward. See detailed checklist in `./FORMY_DYNAMIC_LOADING_REPORT.md` § 5.1.

**Status:** Pending.

### 6.8. Create `FormyInput` Component (NEXT FEATURE)

A controlled-input wrapper component for the render-prop/controlled mode that integrates with Formy's error/validation system. Should handle:
- Binding a controlled `<input>` to the validation registry (`registerValidator`)
- Automatically clearing field errors on user input
- Consistent error display styling

**Proposed API:**

```tsx
<Formy action={loginAction}>
    {(state, isPending) => (
        <>
            <FormyInput
                name="email"
                value={email}
                onInput={setEmail}
                validate={(v) => v.includes("@") ? null : "Invalid email"}
            />
            <FormyInput
                name="password"
                type="password"
                value={password}
                onInput={setPassword}
                validate={(v) => v.length >= 8 ? null : "Min 8 characters"}
            />
            <FormySubmit>Sign In</FormySubmit>
        </>
    )}
</Formy>
```

**Key design decisions to resolve:**
- Should `FormyInput` render the error message itself, or delegate to a sibling `<FormyError>`?
- Should it support uncontrolled mode too (just `name` + `validate`, no `value`/`onInput`)?
- Integration with persist bridge in controlled mode

**Status:** Pending design discussion.

## 11. Architecture v10.0: `plainMode` Prop & SSR Decision Analysis (July 10, 2026)
- **New Prop (`plainMode`):** Added `plainMode?: boolean` to `FormyProps`. When `true`, bypasses dynamic loading of `FormyCore` and renders a plain `<form>` / `<Form>` for ReactNode children directly. Ideal for forms without Server Actions (e.g. search forms, client-side fetch handlers).
- **SSR Decision (`ssr: true` vs `ssr: false`):** Conducted a thorough analysis of `ssr: false` with a skeleton fallback rendering `children`. Concluded that `ssr: true` is the only architecturally sound approach for Formy's uncontrolled mode due to:
  1. DOM Swap/Unmount overhead (React destroys and recreates input DOM nodes on chunk load).
  2. No server CPU savings (children still rendered inside the skeleton fallback).
  3. TTI delay due to missing `<link rel="preload">` for the chunk.
  4. Browser autofill/password manager compatibility issues.
- **Documentation:** Full analysis recorded in `../../src/libs/formy/TECHNICAL.md` § 7.
- **Bundle Cleanup:** Moved `@next/bundle-analyzer` from `dependencies` to `devDependencies` in `package.json`.

### 13. Controlled-Mode Error Clearing (RESOLVED)
- **Solution:** Integrated `clearFieldError` into `FormyInput` via the `onInput`/`onChange` lifecycle. This ensures that field-specific errors are cleared as soon as the user interacts with the input, preventing the stale error flash during sequential submits in controlled mode.

---

## Current TODO List (as of July 10, 2026)

### 🔴 High Priority

- [x] **6.9. Error clearing for controlled inputs in lightweight/plainMode:**
  Resolved via `<FormyInput>` component encapsulating its own `clearFieldError` calls.
- [x] **6.7. Testing dynamic loading (FormyCore):**
  - RSC/uncontrolled mode: verify dynamic chunk load, fieldset enable, value restoration on error.
All key events now have color-coded `console.log` with `[Formy: <id>]` prefix:

| Color | Event |
|:---|:---|
| 🔵 Cyan | Every render (state snapshot) |
| 🟢 Green | Mount hydration, success clear/restore |
| 🟠 Orange | Input, change, checkbox, radio, select, file events |
| 🟣 Purple | Field validation result (PASSED/FAILED) |
| 🔴 Hot pink | Form submit |
| 🔴 Red | Client validation failed |
| 🔵 Teal | `restoreFromValues` DOM restoration |

> **Note:** In React Strict Mode (dev only), the render body runs twice per render cycle. Double render logs are a Strict Mode artifact, not a bug.

### 4.13. FormyActionState Simplification & Prop Cleanup (July 8, 2026)

**Problem:** The `success` boolean field was redundant and created ambiguity about action results. Additionally, unused props (`submitLabel` / `loadingLabel`) cluttered the `<Formy>` component API.

**Solution:** Removed the `success` field from `FormyActionState` and migrated all success checking logic to `"data" in state` pattern. The unused `submitLabel` and `loadingLabel` props were fully removed from the `<Formy>` component props interface while keeping explicit `<FormySubmit>` support intact.

---

## 5. What FormyContext Is Still Needed For

`FormyContext` **cannot be replaced** by `useFormStatus`. The native hook only provides `pending`, `data`, `method`, `action` — not the returned Server Action state.

Components that depend on `FormyContext`:
- `FormyError` — reads `state.error` + calls `registerValidator`
- `FormySuccess` — reads `state.data`
- Render-prop `children` — receives `state, isPending`

---

## 6. Pending Items (TODO)

### 6.1. File Input Limitation (Known, not critical)
Browsers block programmatic setting of `<input type="file">` values for security. File inputs always reset on validation error.
- **Current mitigation:** `savedFiles` ref captures the `FileList` on change and attempts restore via `DataTransfer` API.
- **Limitation:** `DataTransfer`-based restore is not supported in all environments.

### 6.2. Custom UI Component Compatibility
Third-party UI libraries (Radix, Shadcn) hide native inputs. `querySelectorAll("input")` + `setNativeValue` won't reach them.
- **When:** When such components are introduced into forms.

### 6.3. Live Validation UX Improvements
Validation fires on every keystroke (real-time). No debounce is applied yet.
- **When:** Gradual, as UX requirements grow.

---

## 7. Current Form IDs in Use

| Form | `id` prop | File |
|:---|:---|:---|
| Login | `login-form` | `src/components/Forms/LoginForm/index.tsx` |
| Image Upload | `image-upload-form` | `src/components/Forms/ImageUploadForm.tsx` |

*Last updated: July 8, 2026*

## 6.4. Stale Error Flash on Sequential Submits (RESOLVED, July 5)

**Symptom:**
1. Submit #1 → Server Action returns a **global** error (e.g. `{ success: false, error: "Invalid credentials" }`).
2. User edits a field, submits again → this time the error is **field-specific** (e.g. email error).
3. On screen, for roughly a second, the **old global error re-appears**, then disappears, and only *after* that the **new field error** shows up on the email input.

The same glitch happens in reverse — field error first, then a global error on the next submit — the stale one flashes before being replaced.

**Suspected cause (per user):**
In a previous update, a handler was added that clears the currently-displayed error once the user starts typing a new value into an input. The glitch is suspected to originate from this "clear error on input" handling.

**Status:** Resolved. The reset of `editedFields` was moved from the start of the submission (when `resolvedIsPending` becomes `true`) to the end of the submission (when `resolvedIsPending` transitions from `true` to `false`). This ensures that the filtered stale errors remain hidden while the Server Action is running.

### 6.5. Codebase Walkthrough & Hooks Discussion (RESOLVED, July 8, 2026)
- **Symptom/Goal:** Detailed review of Formy's internal hook design to align on the lifecycle and state management.
- **Status:** Resolved. All individual refs (`prevIsPending`, `savedValuesRef`, `savedFilesRef`, `isRestoringRef`, `hasHydrated`, `persistRef`) were consolidated into a single `localState` ref object with clear JSDoc explanations for each field.
- **Action State Separation:** The transition tracking and DOM restoration effects were moved into `FormyCore`'s action state handler, registered into a parent-owned `onActionChangeRef` callback. This prevents `FormyCore` from re-rendering on parent `state` / `isPending` updates.

### 6.6. Architectural Scope Issue: FormyCore is RSC-Only by Design (July 8, 2026)

**Discovery:** During session review, we identified that **the entire FormyCore DOM manipulation layer exists exclusively to serve the RSC/uncontrolled input scenario**. This is not a limitation — it is the fundamental architectural purpose of Formy. However, it raises an important scope concern.

**The Core Insight:**

Formy's main goal is to keep `<input>` elements as **React Server Components (RSC)** — zero JS hydration for field layouts. The `<Formy>` client boundary wraps the form, while children (inputs, labels, layout divs) remain server-rendered static HTML.

Because RSC inputs are **uncontrolled** (no `useState`, no `onChange` from React), the only way to restore their values after React 19's automatic `form.reset()` + RSC refresh is **direct DOM manipulation**. This is why `FormyCore` exists with its full DOM machinery.

**The Problem with Controlled Inputs:**

If a consumer creates a `'use client'` form (e.g., `LoginForm` with `useState` for each input) and wraps it in `<Formy>`, the following FormyCore internals become **dead weight** — code that runs but serves no purpose:

| FormyCore Internals | Purpose (RSC scenario) | Needed for `useState` inputs? |
|:---|:---|:---|
| `savedValuesRef` | Snapshot DOM values before reset | ❌ Values live in React state |
| `formRef.querySelectorAll("input")` | Discover uncontrolled inputs in DOM | ❌ React already tracks them |
| `setNativeValue` / `setNativeChecked` | Restore values via native DOM setters | ❌ `setValue(x)` triggers re-render |
| `isRestoringRef` guard | Prevent infinite loops during DOM restoration | ❌ No DOM restoration occurs |
| `handleInput` / `handleChange` interception | Capture input from uncontrolled elements | ❌ `onChange` already manages state |
| `restoreFromValues` useEffect | DOM restoration on `isPending: true→false` | ❌ Just `setState(savedValue)` |
| `prevIsPending` ref | Detect action completion transition | ❌ Not needed without DOM restoration |

With controlled inputs, the entire restoration logic collapses to a single line: `setEmail(savedEmail)`.

**Why alternatives to `setNativeValue` don't work for RSC inputs:**

1. **`defaultValue` via server response** — `useActionState` is a client hook; RSC inputs cannot access it. And `children` is opaque `ReactNode` — the client `<Formy>` parent cannot inject props into RSC children.
2. **`onSubmit` + `e.preventDefault()`** — Prevents `form.reset()` but not the RSC refresh, which re-renders inputs with original `defaultValue`.
3. **React Context** — RSC cannot consume context (`useContext` is client-only).
4. **`useOptimistic` / render props** — Both require inputs to become client components, defeating the purpose.

**Conclusion:** `setNativeValue` / `setNativeChecked` via native property descriptors is the **only viable best practice** for restoring uncontrolled RSC input values. All alternatives collapse into "make inputs client-side," which contradicts Formy's core architectural goal.

**Resolution (July 8, 2026):** We implemented **Option 2 (Lightweight mode)** with dynamic importing:
1. **Dynamic FormyCore Loading:** In `Formy.tsx`, we inspect the `children` type.
   - If `children` is a function (controlled/render-prop mode) → we render a lightweight `<form>` or `<Form>` directly. The heavy DOM restoration logic and helpers are **not imported or loaded** at all.
   - If `children` is a `ReactNode` (RSC/uncontrolled mode) → we dynamically import `FormyCore` (using `next/dynamic` with `ssr: true` default). All DOM-handling refs, hooks, and effects are encapsulated inside `FormyCore.tsx`.
2. **Zero-Rerender Loading Barrier:** During the dynamic loading of `FormyCore`, the form contents are wrapped in `<fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>` *inside* `FormyCore`.
   - On the server and initial client paint, the fieldset is natively `disabled`.
   - When the `FormyCore` chunk finishes loading and mounts on the client, it directly sets `fieldsetRef.current.disabled = false` inside its mount effect.
   - This avoids any React state updates (`useState`) or parent component re-renders, adhering fully to the **Zero-Rerender** architecture of Formy.

**Status:** Resolved. Full documentation: `../../src/libs/formy/TECHNICAL.md`

### 6.7. Testing Dynamic Loading Changes (HIGH PRIORITY)

Current dynamic loading implementation requires manual and automated verification before moving forward. See detailed checklist in `./FORMY_DYNAMIC_LOADING_REPORT.md` § 5.1.

**Status:** Pending.

### 6.8. Create `FormyInput` Component (NEXT FEATURE)

A controlled-input wrapper component for the render-prop/controlled mode that integrates with Formy's error/validation system. Should handle:
- Binding a controlled `<input>` to the validation registry (`registerValidator`)
- Automatically clearing field errors on user input
- Consistent error display styling

**Proposed API:**

```tsx
<Formy action={loginAction}>
    {(state, isPending) => (
        <>
            <FormyInput
                name="email"
                value={email}
                onInput={setEmail}
                validate={(v) => v.includes("@") ? null : "Invalid email"}
            />
            <FormyInput
                name="password"
                type="password"
                value={password}
                onInput={setPassword}
                validate={(v) => v.length >= 8 ? null : "Min 8 characters"}
            />
            <FormySubmit>Sign In</FormySubmit>
        </>
    )}
</Formy>
```

**Key design decisions to resolve:**
- Should `FormyInput` render the error message itself, or delegate to a sibling `<FormyError>`?
- Should it support uncontrolled mode too (just `name` + `validate`, no `value`/`onInput`)?
- Integration with persist bridge in controlled mode

**Status:** Pending design discussion.

## 11. Architecture v10.0: `plainMode` Prop & SSR Decision Analysis (July 10, 2026)
- **New Prop (`plainMode`):** Added `plainMode?: boolean` to `FormyProps`. When `true`, bypasses dynamic loading of `FormyCore` and renders a plain `<form>` / `<Form>` for ReactNode children directly. Ideal for forms without Server Actions (e.g. search forms, client-side fetch handlers).
- **SSR Decision (`ssr: true` vs `ssr: false`):** Conducted a thorough analysis of `ssr: false` with a skeleton fallback rendering `children`. Concluded that `ssr: true` is the only architecturally sound approach for Formy's uncontrolled mode due to:
  1. DOM Swap/Unmount overhead (React destroys and recreates input DOM nodes on chunk load).
  2. No server CPU savings (children still rendered inside the skeleton fallback).
  3. TTI delay due to missing `<link rel="preload">` for the chunk.
  4. Browser autofill/password manager compatibility issues.
- **Documentation:** Full analysis recorded in `../../src/libs/formy/TECHNICAL.md` § 7.
- **Bundle Cleanup:** Moved `@next/bundle-analyzer` from `dependencies` to `devDependencies` in `package.json`.

### 13. Controlled-Mode Error Clearing (RESOLVED)
- **Solution:** Integrated `clearFieldError` into `FormyInput` via the `onInput`/`onChange` lifecycle. This ensures that field-specific errors are cleared as soon as the user interacts with the input, preventing the stale error flash during sequential submits in controlled mode.

---

## Current TODO List (as of July 10, 2026)

### 🔴 High Priority

- [x] **6.9. Error clearing for controlled inputs in lightweight/plainMode:**
  Resolved via `<FormyInput>` component encapsulating its own `clearFieldError` calls.
- [x] **6.7. Testing dynamic loading (FormyCore):**
  - RSC/uncontrolled mode: verify dynamic chunk load, fieldset enable, value restoration on error.
  - Render-prop/controlled mode: verify `FormyCore` chunk is NOT downloaded (Network tab).
  - `plainMode`: verify ReactNode children render without chunk loading.
- [x] **Remove `until(1000)` debug delay before production:**
  The artificial delay in `Formy.tsx` dynamic import is strictly for development testing of the zero-rerender loading barrier.

### 🟡 Medium Priority

- [x] **6.8. Create `FormyInput` component:**
  A controlled-input wrapper for render-prop/controlled mode with automatic validation registry binding, error clearing on input, and consistent error display styling.

### 🟢 Low Priority / Future

- [x] **Third-party UI library compatibility (Shadcn / Radix):**
  Resolved via `useErrorsContext(name)` hook — now exported as public API from `index.ts`. Custom components wrap the Radix/Shadcn element, call `clearFieldError` on `onValueChange`, and render `<FormyError>` as a sibling. Full example in `README.md` Pattern I and `TECHNICAL.md` § 9.

- [ ] **Client-side validation debounce:**
  Currently validation fires on every keystroke. For async checks (e.g. email uniqueness) a debounce mechanism is needed.

- [x] **File input restoration limitations (RESOLVED, July 10, 2026):**
  Removed programmatic DataTransfer file restoration from FormyCore due to security restrictions and poor cross-browser reliability. Instead, the established best practice for file inputs is to upload files immediately to temporary storage on input change, and manage cleanup across three layers:
  1. `useEffect` cleanup for SPA/client-side navigation.
  2. `sendBeacon` in `pagehide` for normal tab/browser closures.
  3. Server Cron/TTL cleanup job (e.g., 2 hours) as a safety net for crashes, network drops, and power loss.
  A non-functional template illustrating this pattern was added to `ImageUploadForm.tsx`.

---

## 14. Architecture v12.0: DOM-Based Isolated Value Restoration & Zero-Store Sync (July 12, 2026)

### Objective
Simplify the DOM restoration architecture of Formy, eliminate global DOM-querying loops (`querySelectorAll`) in `FormyCore`, and completely decouple the library from external state management (Zustand).

### Architectural Decisions

#### 1. DOM Element Node as Local State Storage (`Symbol`)
Instead of utilizing a heavy global store (Zustand) or context value mapping to cache user-typed values, we store the typed data directly on the physical DOM node itself using a unique `Symbol`:
- `el[REGISTRY_KEY] = el.value` for text elements, and `.checked` status for checkboxes/radios.
- **Why:** During Server Action executions, React reconciles and reuses the physical DOM elements (as their keys and positions remain unchanged). The properties assigned to DOM nodes in memory are preserved across transitions.
- **Impact:** Eliminates the need for any default Zustand store under the hood. Formy is now 0-dependency.

#### 2. React 19 Client-Side Ref Cloning for RSC Inputs
To maintain inputs as React Server Components (RSC) without exposing their `ref` property directly on the server (which throws RSC serialization errors), we wrap inputs in a Client Component helper (`RestoreInputValue`) that clones the child and attaches the `ref` on the client:
- **Why not `document.getElementById`:** Global DOM queries require generating and managing unique `id` props for every single input field, which increases boilerplate and causes ID collision bugs when duplicate forms are mounted.
- **Implementation:**
  ```tsx
  export function RestoreInputValue({ children }: { children: ReactNode }) {
      const { state } = useContext(FormyContext);
      const inputRef = useRef<HTMLInputElement>(null);

      useEffect(() => {
          if (inputRef.current) {
              inputRef.current.value = getInputData(inputRef.current) || "";
          }
      }, [state]);

      // Safely clone first child element and apply client ref
      return cloneElement(
          Children.toArray(children)[0] as ReactElement<{ ref?: RefObject<HTMLInputElement | null> }>,
          { ref: inputRef }
      );
  }
  ```

#### 3. Component-Level Self-Aware Type Restorations
Instead of keeping a giant switch-case in `FormyCore` for restoring checkbox, radio, or select values, `RestoreInputValue` parses the `type` prop directly from the cloned React element:
- `const inputType = child.props.type || "text";`
- Inside `useEffect`, it restores either `.value` or `.checked` based on `inputType`, keeping the restoration logic localized and clean.

#### 4. Decentralized Zustand/External Store Synchronization
If a developer still wants to sync values with a custom store (Zustand/Redux/LocalStorage) from a Server Component form, they write a simple `'use client'` callback handler using the store's vanilla JS API (`getState`/`setState`) and pass it to `<FormyInput onChange={handleUserChange} />`.
- **Why:** Allows developers to wire up any store without complex bridge providers or library dependencies.

```typescript
// handlers.ts — 'use client'
import { myStore } from "@/store/myStore";
export const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    myStore.setState({ email: e.target.value });
};
```
```tsx
// Form.tsx — Server Component (RSC)
import { handleEmailChange } from "./handlers";
<FormyInput name="email" onChange={handleEmailChange} />
```

---

*Last updated: July 12, 2026*

---

## 15. Architecture v12.0 — Final Implementation (July 12, 2026, Session Resumed)

### Context
The session that planned v12.0 was interrupted before implementation. The developer implemented v12.0 independently, with several key deviations from the plan.

### What Was Planned vs. What Was Built

| Planned (session log §14) | Actually Implemented |
|:---|:---|
| `Symbol` on DOM node as value storage | `useRef<string \| null>` inside `RestoreInputValue` |
| Single `RestoreInputValue` wrapping RSC children via `cloneElement` | `<FormyInput>` → `<DynamicInput>` → `<RestoreInputValue>` per-input |
| `FormyCore` dynamic chunk still existed | `FormyCore` fully eliminated |
| Dynamic import target: `FormyCore` | Dynamic import target: `RestoreInputValue` only |
| `querySelectorAll` eliminated via `RestoreInputValue` | ✅ No `querySelectorAll` anywhere |
| `setNativeValue` / `setNativeChecked` eliminated | ✅ Direct `el.value` / `el.checked` assignment (no React synthetic event needed since `RestoreInputValue` owns the ref) |

### What Was Actually Built

#### Core: `RestoreInputValue` (per-input client wrapper)
- Wraps a plain `<input>` via `cloneElement`, attaching `ref` and replacing `onChange`
- Stores value in `useRef<string | null>` — no Symbol, no global store
- Restores via `useLayoutEffect([state])` — synchronous, no flash
- Handles checkbox (`.checked`) and radio (`.checked` + `.value`) types

#### `DynamicInput` (lazy loader)
- Reads `plainMode` from `FormyModeContext`
- In `plainMode`: renders plain `<input>` directly
- Otherwise: dynamically loads `RestoreInputValue` with `next/dynamic`

#### `FormyInput` (public API component)
- Composes `DynamicInput` + embedded `<FormyError>`
- `validate` prop wired to `FormyError` → `registerValidator`
- All error props (`errorBelow`, `errorAbsolute`, `errorHelpText`, `errorParseMessage`) forwarded

#### `Formy.tsx` (simplified orchestrator)
- No `FormyCore` — `fieldset disabled` barrier lives directly in `Formy`
- `useFormyErrorStore` → `createErrorsStore` → `useSyncExternalStore` for zero-rerender error propagation
- `validatorsRef` + `handleLightSubmit` for client-side validation on submit
- Three contexts: `FormyContext` (state/isPending), `FormyModeContext` (plainMode/clearOnSuccess), `ErrorsContext` (store + validators)

#### Eliminated
- `FormyCore.tsx` — gone
- `domHelpers.ts` (`setNativeValue`, `setNativeChecked`) — gone
- `createPersistBridge.tsx` — gone
- `usePersistedForm.ts` — gone
- `FormyPersistContext.tsx` — gone
- `formStore.ts` (Zustand) — gone
- `FormStoreProvider.tsx` — gone
- Zustand dependency — **Formy is now 0-dependency**

### Cleanup Applied (July 12, 2026)
- Removed stray `)` on line 125 of `Formy.tsx` (leaked into JSX output)
- Removed `onLoad: _onLoad` dead prop destructuring from `Formy.tsx`
- Removed dead `FormyCoreProps` interface from `types.ts`

### Documentation Updated (July 12, 2026)
- `README.md` — full rewrite: removed FormStoreProvider step, updated Quick Start to `<FormyInput>`, removed Pattern H (createPersistBridge), fixed `onInput` → `onChange`, removed Zustand from requirements
- `TECHNICAL.md` — full rewrite: replaced FormyCore/setNativeValue sections with RestoreInputValue architecture, updated SSR analysis to reflect DynamicInput scope

*Last updated: July 12, 2026*
