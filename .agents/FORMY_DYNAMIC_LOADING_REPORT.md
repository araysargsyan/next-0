# Formy Dynamic Loading & Lightweight Mode — Session Report

> **Date:** July 8, 2026
> **Scope:** Dynamic `FormyCore` import, zero-rerender loading barrier, lightweight render-prop mode
> **Status:** Implementation complete, pending testing

---

## 1. Summary of Changes

### 1.1. Dynamic FormyCore Loading

`FormyCore` (the heavy DOM-manipulation layer for uncontrolled RSC inputs) is now loaded via `next/dynamic`:

```tsx
const FormyCoreDynamic = dynamic(() => import("./FormyCore").then(m => ({ default: m.FormyCore })));
```

**Why:** `FormyCore` contains all the DOM restoration machinery (`setNativeValue`, `setNativeChecked`, `savedValuesRef`, `restoreFromValues`, etc.) that is **only needed** when `children` is a `ReactNode` (uncontrolled/RSC mode). When `children` is a render-prop function (controlled mode), none of this code is needed.

**Result:** In controlled/render-prop mode, the `FormyCore` chunk is **never downloaded** — the browser only loads the lightweight `<Form>` / `<form>` path.

### 1.2. Zero-Rerender Loading Barrier (fieldset pattern)

During `FormyCore` dynamic loading, the form content is wrapped in a natively disabled fieldset *inside* `FormyCore`:

```tsx
<fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
    {children}
</fieldset>
```

**Lifecycle:**
1. Server render + initial client paint: fieldset is `disabled` → all inputs are non-interactive.
2. `FormyCore` chunk finishes loading and mounts on the client → triggers a local `useEffect` mount callback.
3. `FormyCore` writes `fieldsetRef.current.disabled = false` directly to the DOM.
4. No `useState` update, no parent or child re-render — pure DOM mutation.

**Why not `useState`:** A state update would trigger a full re-render of `<Formy>` and all its children. The fieldset approach keeps it at zero rerenders, consistent with Formy's architecture.

### 1.3. Lightweight Render-Prop Mode

When `children` is a function (`typeof children === "function"`), Formy renders a plain `<Form>` (or `<form>` for non-action forms) directly — no `FormyCore`, no DOM restoration, no dynamic import:

```tsx
{isRenderProp ? (
    formAction ? (
        <Form ref={formRef} action={formAction} onSubmit={handleLightSubmit} ...>
            {children(state, isPending)}
        </Form>
    ) : (
        <form ref={formRef} onSubmit={handleLightSubmit} ...>
            {children(state, isPending)}
        </form>
    )
) : (
    <FormyCoreDynamic ...>
        <fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
            {children}
        </fieldset>
    </FormyCoreDynamic>
)}
```

Client-side validation (`validatorsRef`) still works in lightweight mode via `handleLightSubmit`.

---

## 2. Files Modified

| File | Change |
|:---|:---|
| `src/libs/formy/Formy.tsx` | Added `next/dynamic` import, `FormyCoreDynamic`, `onActionChangeRef`, render-prop branching |
| `src/libs/formy/FormyCore.tsx` | Extracted as standalone component, encapsulates `fieldsetRef` and disables/enables loading barrier internally, registers change handler |
| `src/libs/formy/types.ts` | Added `onActionChangeRef` to `FormyCoreProps` |

---

## 3. Type-Check Status

`tsc --noEmit` passes cleanly. All props have been stabilized, preventing any unnecessary re-renders of `FormyCore` when parent state changes.

---

## 4. Next Steps

### 4.1. Testing Current Changes (HIGH PRIORITY)

The dynamic loading implementation needs manual and automated testing:

- [ ] **RSC/uncontrolled mode:** Verify that `FormyCore` loads dynamically, fieldset enables after load, form submission and error restoration work as before
- [ ] **Render-prop/controlled mode:** Verify that `FormyCore` chunk is NOT downloaded (check Network tab), lightweight form renders correctly, client validation works
- [ ] **Edge cases:** Rapid form submissions during `FormyCore` loading, navigation away during loading, HMR behavior

### 4.2. Create `FormyInput` Component (NEXT FEATURE)

**Goal:** A controlled-input wrapper component that integrates with Formy's error system for the render-prop/controlled mode.

**Problem it solves:** Currently, controlled inputs in render-prop mode need manual wiring to display validation errors. There is no standard component for:
- Binding a controlled `<input>` to `FormyError`'s validation registry
- Automatically clearing field errors on user input
- Providing consistent error display styling

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

---

*Last updated: July 8, 2026*
