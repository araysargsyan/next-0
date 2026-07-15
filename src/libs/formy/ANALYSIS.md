# formy-next — Deep Analysis & Verdict

> Independent code review of `src/libs/formy`. For usage, see [README.md](./README.md); for internal design rationale, see [TECHNICAL.md](./TECHNICAL.md).

---

## 1. What it is

A zero-dependency form library built specifically for Next.js 16 / React 19 Server Actions. It solves one narrow, real problem: React 19's `useActionState` calls `form.reset()` after *every* action completes — including validation errors — wiping user-typed values. Formy restores those values without full client hydration of the form.

**Real usage today:** [`src/app/sign-in/actions.ts`](../../app/sign-in/actions.ts) and [`src/app/(home)/actions.ts`](../../app/(home)/actions.ts). No test files exist for the package.

**Dependencies:** none beyond `next`, `react`, `react-dom` — confirmed via `package.json`. No `react-hook-form` or `formik` present; Formy was built from scratch rather than trimming an existing library.

---

## 2. Architecture

```
Formy (orchestrator, "use client")        useActionState + <fieldset disabled> mount barrier
 ├─ FormyContext                          {state, isPending} — plain React context
 ├─ FormyModeContext                      {staticMode, clearOnSuccess}
 ├─ ErrorsContext                         external pub/sub store (createErrorsStore)
 │
 ├─ FormyInput (server-renderable) → DynamicInput ("use client") → RestoreInputValue (lazy, "use client")
 │     cloneElement(<input>, {ref, onChange}) → useLayoutEffect restores
 │     el.value / el.checked from a local ref when `state` changes
 │
 └─ FormyError ("use client")             useSyncExternalStore, keyed per-field
                                           → only the field whose error changed re-renders
```

Core mechanism: server errors flow through an external store (`useSyncExternalStore`) instead of React state in `Formy`, so a validation error never re-renders the parent or sibling inputs — only the one `FormyError` whose key changed. The `<fieldset disabled>` mount barrier is flipped via direct DOM mutation (`fieldsetRef.current.disabled = false`) instead of `useState`, for the same zero-rerender reason.

### Client/server boundary (verified via `"use client"` directives)

| File | Boundary |
| :--- | :--- |
| `Formy.tsx` | client |
| `components/FormyInput/index.tsx` | **server-renderable** (no directive) |
| `components/FormyInput/DynamicInput.tsx` | client |
| `components/FormyInput/RestoreInputValue.tsx` | client (lazy-loaded via `next/dynamic`) |
| `components/FormyError.tsx` | client |
| `components/FormySubmit.tsx` | client |
| `components/FormySuccess.tsx` | client |
| `contexts/ErrorsContext.tsx` | client |
| `contexts/FormyContext.ts`, `FormyModeContext.ts` | server-renderable |
| `hooks/*.ts` | client |
| `utils/*.ts` | server-renderable |

`FormyInput` itself is the only "renders an input" component with no client directive — when composed from a Server Component parent (the pattern the docs push), this wrapper function never ships to the browser. Everything it delegates to internally (`DynamicInput`, `RestoreInputValue`, `FormyError`) is a client component.

---

## 3. Bugs found

Ranked by severity. (Per user direction, these are logged here for the record but are **not** being fixed in this pass.)

### 3.1 Radio buttons can silently revert to a stale selection
**File:** [`components/FormyInput/RestoreInputValue.tsx:61-62`](./components/FormyInput/RestoreInputValue.tsx#L61-L62)

Each radio option is a separate component instance with its own `value` ref. Only the radio that becomes *checked* fires `onChange` — a previously-checked radio that gets deselected never fires an event, so its ref still holds the old value. The restore effect runs on *every* `state` change (any server error, even from an unrelated field) and does `el.checked = el.value === value.current` per radio instance — so the stale, deselected radio also re-asserts `checked = true`. Because same-`name` radios are natively mutually exclusive in the browser, whichever instance's DOM assignment runs *last* wins — which can be the stale one, not the user's actual last choice.

**Failure scenario:** user selects "user", then switches to "admin", then submits and the server returns an unrelated field error (e.g. invalid email). The restore effect fires for all inputs; depending on DOM order, the radio group can jump back to "admin"/"user" incorrectly, without any user action, corrupting the next submission's payload.

**Status:** latent — only exercised by the README's own example, not yet used in the live app.

### 3.2 `FormySubmit`'s auto-disable-while-pending can be silently defeated
**File:** [`components/FormySubmit.tsx:26-32`](./components/FormySubmit.tsx#L26-L32)

```tsx
<button
    disabled={isPending || props.disabled}
    ...
    {...props}          // spread AFTER disabled — overwrites it
>
```

`className`/`style` are destructured out before this spread, but `disabled` isn't. If a consumer ever passes their own `disabled` prop (e.g. `disabled={!isValid}`), `{...props}` overwrites the computed `isPending || props.disabled` with the raw `props.disabled`. While pending, if the caller's value is `false`, the button stays clickable — contradicting the documented "Automatically disables ... while the action is pending" and opening the door to double-submits.

### 3.3 Documented `FormyActionState` type isn't actually exported
**File:** [`index.ts`](./index.ts)

The README's Quick Start and Pattern G both show:
```tsx
import type { FormyActionState } from 'formy-next';
```
but `index.ts` only re-exports `FormyAction`, not `FormyActionState`. Following the docs verbatim produces a `TS2305` compile error.

### 3.4 `useFormyState`'s "must be used within `<Formy>`" guard is dead code
**File:** [`hooks/useFormyState.ts:8-9`](./hooks/useFormyState.ts#L8-L9) vs [`contexts/FormyContext.ts:9-12`](./contexts/FormyContext.ts#L9-L12)

`FormyContext` is created with a non-null default value (`{state: null, isPending: false}`), so `useContext(FormyContext)` never returns falsy — the `if (!ctx) throw` in `useFormyState` can never fire. Calling the hook outside a `<Formy>` boundary silently returns defaults instead of throwing, unlike its sibling `useFormyErrors` (whose `ErrorsContext` correctly defaults to `null` and does throw, as documented in the README). Inconsistent fail-fast behavior between two public hooks with near-identical guard code.

### 3.5 Minor
- `useFormyState` is exported but undocumented in the README's API Reference.
- `FormyError`'s `else if (!field)` branch ([FormyError.tsx:34](./components/FormyError.tsx#L34)) is unreachable in practice — `field` defaults to `'__global__'`, which is always truthy unless someone explicitly passes `field=""`.

---

## 4. Verdict

### 4.1 "Does this keep form inputs server-generated with no client-side execution?"

**No, not in the default mode — and that's not actually what the design claims.**

- `FormyInput` itself has no `"use client"` directive — composed from a Server Component parent, this wrapper genuinely never ships to the browser.
- But everything it delegates to — `DynamicInput`, `RestoreInputValue`, `FormyError` — **is** `"use client"` and **does** execute in the browser: `RestoreInputValue` attaches a ref via `cloneElement`, listens to `onChange`, and runs a `useLayoutEffect` on every Server Action state change; `FormyError` subscribes to the error store and re-renders on change.

So in default mode, every `<FormyInput>` still has live client JS behind it. What Formy actually avoids is turning the **whole form** into one client component with `useState` per field. Instead of one big client bundle for the entire form, you get small, per-input client components, and the heaviest one (`RestoreInputValue`) is code-split via `next/dynamic` rather than inlined into the main bundle. That's "less JS on the critical path and better composition," not "no JS."

**The one place the claim is literally true: `staticMode={false}`.** There, `DynamicInput` returns the server-rendered `<input>` directly and `RestoreInputValue` is never imported — for that input, there is genuinely no restoration JS shipped or executed, just the static element plus the (unavoidable) `FormyError` client component for error display.

### 4.2 "Does this approach save real MB?"

**Yes, but modestly — and the saving is architectural, not "a large dependency removed."**

- No `react-hook-form` / `formik` in `package.json` — this was built from scratch to avoid that class of dependency, not to trim an existing one.
- The actual client-side surface area is small: `RestoreInputValue` is 2.6KB source, `FormyError` 4.5KB, `Formy.tsx` 4.5KB — a few KB total pre-minification, realistically under 1–2KB gzipped combined. That's the entire cost being avoided versus pulling in a full form-management library with its own subscribe/watch engine and resolver adapters.
- In **default mode**, nothing is truly removed from total bytes transferred — `next/dynamic` code-splits `RestoreInputValue` into its own chunk that's preloaded and fetched in parallel with the main bundle. That's a load-order / TTI win (form becomes interactive sooner, no main-bundle bloat), **not** a reduction in total KB downloaded.
- In **`staticMode={false}`**, the saving is real and literal: that chunk is never requested, so those bytes are actually never sent — not just deferred.

**Bottom line:** Formy's real win is avoiding a heavier form-management library and avoiding one monolithic client-rendered form tree. Bundle-size savings are real but small in absolute terms, and only become "zero client JS for restoration" when explicitly opting into `staticMode={false}`.

---

## 5. Prior art on npm

The underlying bug Formy targets is not invented — it's a confirmed, tracked React 19 behavior:

- [react/react#31649](https://github.com/react/react/issues/31649) — "Submitting a `<form>` with an `action` will clear the input values"
- [react/react#29034](https://github.com/react/react/issues/29034) — request to let apps opt out of the auto-reset entirely (still open)

No npm package solves it the way Formy does, but several sit in the same space:

| Package | How it handles it | Gap vs. Formy |
| :--- | :--- | :--- |
| **`@conform-to/react`** ("Conform") | Closest dedicated match — built for progressive enhancement with Server Actions, feeds `lastResult` back into `defaultValue` on inputs | Per the maintainer's own explanation ([discussion #1111](https://github.com/edmundhung/conform/discussions/1111)): React 19's auto-reset fires *before* Conform can reapply `defaultValue`, so **the exact bug Formy targets is still an open, unresolved limitation in Conform** ("this is also resolved in the future APIs" — i.e. not yet, as of this writing). Formy sidesteps this because it restores via a `useLayoutEffect` DOM mutation that runs *after* React's own reset, not via `defaultValue`/React state. |
| **`react-hook-form`** | Fully controlled, client-hydrated — values live in RHF's own state, so there's nothing for React 19 to "reset" | This is the exact workaround Formy's own README rejects (full client hydration of every field, heavy bundle cost) |
| **`next-safe-action`, `zsa`** | Type-safe wrappers/validation pipelines around Server Actions | Don't address value preservation at all — typically paired *with* react-hook-form for the client-side piece |
| **`@tanstack/react-form`** | Controlled-state form library with server-function adapters | Same category as RHF — solves it by not being uncontrolled, not by restoring DOM state post-reset |

The common community answer today (per Robin Wieruch's and Aurora Scharff's write-ups below) is a hand-rolled `defaultValue={actionState.payload?.get("field")}` pattern — not a library. Formy's combination of RSC-composed inputs, post-reset DOM restoration via ref, a per-field external store for zero-rerender errors, and an optional `staticMode` that skips the client chunk entirely doesn't have a direct off-the-shelf equivalent.

**Sources:**
- [Submitting a `<form>` with an `action` will clear the input values · Issue #31649 · react/react](https://github.com/react/react/issues/31649)
- [Allow opting out of automatic form reset when Form Actions are used · Issue #29034 · react/react](https://github.com/react/react/issues/29034)
- [How can I make sure previous field values are kept after server errors? · edmundhung/conform · Discussion #1111](https://github.com/edmundhung/conform/discussions/1111)
- [How to (not) reset a form after a Server Action in React - Robin Wieruch](https://www.robinwieruch.de/react-server-action-reset-form/)
- [Handling Form Validation Errors and Resets with useActionState() | Aurora Scharff](https://aurorascharff.no/posts/handling-form-validation-errors-and-resets-with-useactionstate/)
- [Best React Form Libraries (2026) — PkgPulse Guides](https://www.pkgpulse.com/guides/best-react-form-libraries-2026)

---

*Analysis date: 2026-07-14.*
