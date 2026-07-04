# Formy

> **Zero-hydration Server Action forms for Next.js 15+ and React 19.**
> Keep your inputs on the server. Keep your data on error.

[![npm version](https://img.shields.io/npm/v/formy)](https://www.npmjs.com/package/formy)
[![license](https://img.shields.io/npm/l/formy)](./LICENSE)
[![react](https://img.shields.io/badge/react-19%2B-blue)](https://react.dev)
[![next](https://img.shields.io/badge/next.js-15%2B-black)](https://nextjs.org)

---

## The Problem

React 19 introduced a painful behavior for Server Action forms: **`form.reset()` is called automatically after every action completes** — including on validation errors.

This means if a user submits a login form and the server returns `{ success: false, error: "Wrong password" }`, React 19 treats the action as *successfully completed* and **wipes all input values**. The user loses their typed email and has to start over.

The community workarounds are unsatisfying:

| Approach | Downside |
| :--- | :--- |
| Make the whole form `'use client'` with `useState` | Entire form markup moves to the JS bundle. RSC advantages lost. |
| Use `react-hook-form` | Requires full client hydration of all fields. Heavy bundle cost. |
| Persist values in URL query params | Pollutes browser history. Insecure for auth forms. |
| Use `defaultValue` + `key` reset trick | Causes full form re-mount and visual flicker. |

**Formy solves this elegantly** — without any of these tradeoffs.

---

## How It Works

Formy intercepts the form's `onSubmit` event to **snapshot all input values into a `useRef` cache** before the Server Action fires. After the action completes on error, it **imperatively restores those values directly in the DOM** — completely bypassing React 19's automatic `form.reset()`.

This means:
- Your `<input>` fields can stay in a **Server Component** (pure static HTML, zero JS hydration weight).
- On error, the user's typed values are preserved automatically.
- On success, the cache is cleared and the form resets cleanly.

---

## Installation

```bash
npm install formy
```

**Peer dependencies:**

```bash
npm install next@^15 react@^19 react-dom@^19
```

---

## Quick Start

### 1. Define a Server Action

```tsx
// app/sign-in/actions.ts
'use server'

export async function signInAction(
    _state: { success: boolean; error?: string | Record<string, string> } | null,
    formData: FormData
) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const user = await db.user.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return { success: false, error: 'Invalid email or password.' };
    }

    return { success: true };
}
```

### 2. Build the Form (Server Component)

```tsx
// components/LoginForm.tsx
import Formy from 'formy';
import { FormyError, FormySubmit } from 'formy';
import { signInAction } from '@/app/sign-in/actions';

// All <input> fields are pure Server Component HTML — zero JS bundle cost.
export default function LoginForm() {
    return (
        <Formy action={signInAction} className="flex flex-col gap-4 w-full max-w-sm">

            <div className="relative">
                <input name="email" type="email" placeholder="Email" required />
                <FormyError field="email" below />
            </div>

            <div className="relative">
                <input name="password" type="password" placeholder="Password" required />
                <FormyError field="password" below />
            </div>

            <div className="relative">
                <FormyError />
                <FormySubmit loadingLabel="Signing in...">Sign in</FormySubmit>
            </div>

        </Formy>
    );
}
```

That's it. On a validation error, the user's email and password are preserved. On success, the form resets cleanly.

---

## Usage Patterns

### Pattern A: Client Callback on Success (Recommended for Auth)

Use `onStateChange` to run client-side logic (like redirecting or writing to `localStorage`) when the Server Action state changes.

**`handlers.tsx`** — a separate Client Reference file:

```tsx
'use client'

import { useRouter } from 'next/navigation';
import type { FormyActionState } from 'formy';

export const handleStateChange = (
    state: FormyActionState | null,
    router: ReturnType<typeof useRouter>
) => {
    if (state?.success) {
        localStorage.setItem('was_logged_in', 'true');
        router.push('/dashboard');
    }
};
```

**`LoginForm.tsx`** — still a Server Component:

```tsx
import Formy from 'formy';
import { FormySubmit, FormyError } from 'formy';
import { signInAction } from '@/app/sign-in/actions';
import { handleStateChange } from './handlers'; // Client Reference

export default function LoginForm() {
    return (
        <Formy action={signInAction} onStateChange={handleStateChange}>
            <input name="email" type="email" required />
            <FormyError field="email" below />

            <input name="password" type="password" required />
            <FormyError field="password" below hasHelp helpText="Min 8 chars, one uppercase, one number." />

            <FormyError />
            <FormySubmit loadingLabel="Signing in...">Sign in</FormySubmit>
        </Formy>
    );
}
```

### Pattern B: Render-prop Children (Dynamic State Access)

Pass a function as `children` to access the current action state and pending status directly in your JSX.

```tsx
<Formy action={submitAction}>
    {(state, isPending) => (
        <>
            <input name="username" type="text" required />
            {isPending && <p>Submitting...</p>}
            {state?.success && <p>Done!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

### Pattern C: Field-specific vs. Global Errors

Your Server Action can return either a single string error or a field-keyed object:

```tsx
// Global error — displayed by <FormyError /> (no `field` prop)
return { success: false, error: 'Something went wrong.' };

// Field-specific errors — each displayed by matching <FormyError field="..." />
return {
    success: false,
    error: {
        email: 'This email is not registered.',
        password: 'Password must be at least 8 characters.',
    }
};
```

### Pattern D: Success-only Children with `FormySuccess`

Wrap content in `<FormySuccess>` to render it only when `state.success === true`:

```tsx
<Formy action={subscribeAction}>
    <input name="email" type="email" required />
    <FormySuccess>
        <p>You are subscribed!</p>
    </FormySuccess>
    <FormySubmit>Subscribe</FormySubmit>
</Formy>
```

### Pattern E: Custom Type-safe State

Extend `FormyActionState` for strongly-typed custom fields on the returned state:

```tsx
import type { FormyActionState, StrictFormyState } from 'formy';

type MyState = FormyActionState & {
    data?: { userId: string };
};

async function myAction(
    _state: MyState | null,
    formData: FormData
): Promise<MyState> {
    // ...
    return { success: true, data: { userId: '123' } };
}

// In your component:
<Formy<MyState> action={myAction}>
    {(state) => (
        <>
            <input name="username" />
            {state?.data?.userId && <p>Welcome, user {state.data.userId}!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

---

## API Reference

### `<Formy>` Props

Extends all standard `next/form` (`<Form>`) props, omitting `children` and `action`.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `action` | `string \| ServerAction` | `undefined` | A Server Action function or a standard URL string for native form submission. |
| `initialState` | `State \| null` | `null` | Initial state passed to `useActionState` before the first submission. |
| `children` | `ReactNode \| ((state, isPending) => ReactNode)` | — | Form content. Accepts JSX or a render-prop function for dynamic state access. |
| `onStateChange` | `(state, router) => void` | `undefined` | Client callback fired whenever the Server Action returns a new state. Receives the Next.js `router` for programmatic navigation. |
| `submitLabel` | `string` | `undefined` | Enables a built-in default submit button with this label text. |
| `loadingLabel` | `string` | `"Loading..."` | Text for the built-in submit button while submitting. |
| `className` | `string` | `"flex flex-col gap-4 w-full max-w-sm"` | CSS class for the `<form>` element. |

---

### `<FormyError>` Props

Renders field-specific or global error messages from the action state. Zero layout shift by default via absolute positioning.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `field` | `string` | `undefined` | Target input name. If omitted, captures the global (string) error. |
| `below` | `boolean` | `false` | Positions the error below the input (`top: 100%`). Default is above. |
| `absolute` | `boolean` | `true` | Absolute positioning to prevent layout shifts. Set `false` for in-flow rendering. |
| `hasHelp` | `boolean` | `false` | Shows an interactive info icon next to the error. |
| `helpText` | `string` | `""` | Static text inside the glassmorphism help tooltip. |
| `parseMessage` | `(msg: string) => { title: string; info: string }` | `undefined` | Splits one error string into a short title and a detailed tooltip body. |

---

### `<FormySubmit>` Props

Extends all standard `<button>` props. Automatically disables and shows loading text while the action is pending.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `loadingLabel` | `string` | `undefined` | Button label while `isPending` is true. |

---

### `<FormySuccess>` Props

Renders children only when `state.success === true`.

| Prop | Type | Description |
| :--- | :--- | :--- |
| `children` | `ReactNode` | Content to show on success. |

---

### `useFormyActionState<State>(action, initialState)`

A hook that wraps React 19's `useActionState`. Safely handles both Server Action functions and plain URL strings. Throws a developer-friendly error if the action type changes dynamically (which would violate React's rules of hooks).

**Returns:** `[state, dispatch, isPending]`

---

### `FormyActionState` Type

The base constraint for all Formy action return types. Your Server Action must return a shape that satisfies this type.

```tsx
type FormyActionState =
    | { success: boolean; error?: string | Record<string, string> | null }
    | { success: boolean; data?: unknown };
```

---

## Why Not `react-hook-form` or `next-safe-action`?

| | `react-hook-form` | `next-safe-action` | **Formy** |
| :--- | :---: | :---: | :---: |
| Works with Server Actions | ✅ | ✅ | ✅ |
| Inputs stay in Server Components (RSC) | ❌ | ✅ | ✅ |
| Preserves input values on validation error | ✅ | ❌ | ✅ |
| Zero extra JS bundle for input markup | ❌ | ✅ | ✅ |
| Built-in error display components | ✅ | ❌ | ✅ |
| No external dependencies | ❌ | ❌ | ✅ |
| TypeScript-first | ✅ | ✅ | ✅ |

Formy is the only solution that **keeps input fields on the server** while **preserving user-typed values on error** — with no extra dependencies.

---

## Requirements

- **Next.js** `^15.0.0`
- **React** `^19.0.0`
- **react-dom** `^19.0.0`

---

## License

MIT
