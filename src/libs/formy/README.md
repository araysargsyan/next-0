# Formy

> **Zero-hydration Server Action forms for Next.js 16+ and React 19.**
> Keep your inputs on the server. Keep your data on error.

---

## The Problem

React 19 introduced a painful behavior for Server Action forms: **`form.reset()` is called automatically after every action completes** — including on validation errors.

This means if a user submits a login form and the server returns `{ error: "Wrong password" }`, React 19 treats the action as *successfully completed* and **wipes all input values**. The user loses their typed email and has to start over.

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

Formy intercepts the form's `onSubmit` event to **snapshot all input values** before the Server Action fires. After the action completes on error, it **imperatively restores those values directly in the DOM** — bypassing React 19's automatic `form.reset()`.

### The Zero-Rerender Architecture
Formy guarantees absolute minimal rendering footprint via a decoupled architecture:
1. **`Formy` (Orchestrator):** Manages `useActionState` and initializes lightweight external stores. It does *not* render the form DOM itself.
2. **`FormyCore` (DOM Layer):** Handles the `<form>` events and DOM restoration.
3. **`FormyError` (Local State):** Subscribes directly to an external `ErrorsStore` and handles real-time client validation locally.

**Result:** Typing in one input or receiving a server validation error *never* triggers a re-render of the parent `<Formy>` component or sibling inputs.

For cross-navigation persistence, Formy integrates with an optional global store (Zustand by default) via a **store-agnostic bridge** — so your store choice doesn't matter.

### Dynamic Loading & Lightweight Mode
Formy is optimized for both uncontrolled (RSC) and controlled (client-side) forms, dynamically tailoring its bundle footprint:
- **Lightweight Mode (Controlled / Render-prop):** If you pass a function as `children`, Formy renders a lightweight `<form>` or `<Form>` directly. The heavy DOM restoration layer (`FormyCore`) is **never downloaded** by the browser.
- **Dynamic Restoration Mode (Uncontrolled / RSC):** If you pass static `ReactNode` JSX as `children`, Formy dynamically imports `FormyCore` (via `next/dynamic` with SSR enabled).
- **Zero-Rerender Loading Barrier:** During the dynamic chunk load, `FormyCore` renders a native `<fieldset disabled>` to prevent early user interaction. When the chunk hydrates on the client, it enables the fieldset directly in the DOM, avoiding any parent or child React re-renders.

This means:
- Your `<input>` fields can stay in a **Server Component** (pure static HTML, zero JS hydration weight).
- On error, the user's typed values are preserved automatically.
- On success, the cache is cleared and the form resets cleanly.

---

## Quick Start

### 1. Define a Server Action

```tsx
// app/sign-in/actions.ts
'use server'

import type { FormyActionState } from '@/libs/formy';

export async function signInAction(
    _state: FormyActionState | null,
    formData: FormData
): Promise<FormyActionState> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const user = await db.user.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return { error: 'Invalid email or password.' };
    }

    return { data: null };
}
```

### 2. Set up the Store Provider (once, in `layout.tsx`)

```tsx
// app/layout.tsx
import { ReactNode } from 'react';
import FormStoreProvider from '@/components/Providers/FormStoreProvider';

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html>
            <body>
                <FormStoreProvider>
                    {children}
                </FormStoreProvider>
            </body>
        </html>
    );
}
```

### 3. Build the Form

```tsx
// components/LoginForm.tsx
import Formy, { FormyError, FormySubmit } from '@/libs/formy';
import { signInAction } from '@/app/sign-in/actions';

export default function LoginForm() {
    return (
        <Formy id="login-form" action={signInAction} className="flex flex-col gap-4">

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

That's it. On validation error, the user's values are preserved. On success, the form resets cleanly.

---

## Usage Patterns

### Pattern A: Client Callback on Success

Use `onStateChange` to run client-side logic (redirect, `localStorage`, etc.) when the Server Action returns.

**`handlers.tsx`** — a separate Client Reference file:

```tsx
'use client'

import { useRouter } from 'next/navigation';
import type { FormyActionState } from '@/libs/formy';

export const handleStateChange = (
    state: FormyActionState | null,
    router: ReturnType<typeof useRouter>
) => {
    if (state && 'data' in state) {
        localStorage.setItem('was_logged_in', 'true');
        router.push('/dashboard');
    }
};
```

**`LoginForm.tsx`:**

```tsx
import { handleStateChange } from './handlers';

<Formy id="login-form" action={signInAction} onStateChange={handleStateChange}>
    ...
</Formy>
```

### Pattern B: Render-prop Children

Pass a function as `children` to access action `state` and `isPending` directly in JSX:

```tsx
<Formy action={submitAction}>
    {(state, isPending) => (
        <>
            <input name="username" type="text" required />
            {isPending && <p>Submitting...</p>}
            {state && 'data' in state && <p>Done!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

> **Note:** The `state` received by render-prop children is the raw Server Action state (`Awaited<State> | null`), not merged with client errors. Use `<FormyError>` for displaying validation errors.

### Pattern C: Field-specific vs. Global Errors

Your Server Action can return either a single string error or a field-keyed object:

```tsx
// Global error — displayed by <FormyError /> (no `field` prop)
return { error: 'Something went wrong.' };

// Field-specific errors — each displayed by matching <FormyError field="..." />
return {
    error: {
        email: 'This email is not registered.',
        password: 'Password must be at least 8 characters.',
    }
};
```

### Pattern D: Success-only Content with `FormySuccess`

```tsx
<Formy action={subscribeAction}>
    <input name="email" type="email" required />
    <FormySuccess>
        <p>You are subscribed!</p>
    </FormySuccess>
    <FormySubmit>Subscribe</FormySubmit>
</Formy>
```

### Pattern E: Client-side Validation

Use the `validate` prop on `<FormyError>` for real-time field validation. Validation runs on every keystroke and on submit. If client errors exist at submit time, the Server Action is **not called**.

> **Important:** `validate` functions must be defined in a `'use client'` module. They **cannot** be passed as props from a Server Component — Next.js will throw `"Functions cannot be passed directly to Client Components"`. Define them in a separate `validators.ts` (with `'use client'`) or inside the Client Component that renders the form.

```tsx
// components/LoginForm/validators.ts
'use client'

export const validateEmail = (val: string) => {
    if (!val) return 'Email is required';
    if (!val.includes('@')) return 'Invalid email format';
    return null;
};

export const validatePassword = (val: string) => {
    if (!val) return 'Password is required';
    if (val.length < 6) return 'Password must be at least 6 characters';
    return null;
};
```

```tsx
// components/LoginForm/index.tsx — Client Component
'use client'
import { validateEmail, validatePassword } from './validators';

<FormyError field="email" below validate={validateEmail} />
<FormyError field="password" below validate={validatePassword} />
```

### Pattern F: Checkbox & Radio Support

Checkboxes and radios are fully supported. Formy restores their checked state after errors.

```tsx
<input type="checkbox" name="remember" />
<input type="radio" name="role" value="admin" />
<input type="radio" name="role" value="user" />
```

**How unchecked checkboxes are handled:** The browser's `FormData` does not include unchecked checkboxes. Formy patches this by explicitly appending `"false"` for any checkbox not present in `FormData` after submission — so unchecked state is reliably restored on error.

### Pattern G: Custom Type-safe State

```tsx
import type { FormyActionState, StrictFormyState } from '@/libs/formy';

type MyState = FormyActionState & {
    data?: { userId: string } | null;
};

async function myAction(
    _state: MyState | null,
    formData: FormData
): Promise<MyState> {
    return { data: { userId: '123' } };
}

<Formy<MyState> action={myAction}>
    {(state) => (
        <>
            <input name="username" />
            {state && 'data' in state && state.data?.userId && <p>Welcome, user {state.data.userId}!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

### Pattern H: Custom Store (Store-agnostic Bridge)

Formy is not coupled to Zustand. You can connect any store that conforms to `FormyStoreSlice`:

```tsx
import { createPersistBridge } from '@/libs/formy';

// Your store hook must expose: forms, setFormValue, clearForm
const FormyReduxBridge = createPersistBridge(useReduxFormStore);

export default function AppProviders({ children }) {
    return (
        <FormyReduxBridge>
            {children}
        </FormyReduxBridge>
    );
}
```

---

## API Reference

### `<Formy>` Props

Extends all standard `next/form` (`<Form>`) props, omitting `children` and `action`.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `undefined` | Form ID used by the global store for cross-navigation persistence. Without `id`, only local `savedValues` ref is used (lost on unmount). |
| `action` | `string \| ServerAction` | `undefined` | A Server Action function or a URL string for native form submission. |
| `initialState` | `State \| null` | `null` | Initial state passed to `useActionState` before the first submission. |
| `children` | `ReactNode \| ((state, isPending) => ReactNode)` | — | Form content. Accepts JSX or a render-prop function. Render-prop receives the raw `Awaited<State> \| null`. |
| `onStateChange` | `(state, router) => void` | `undefined` | Client callback fired on every new Server Action state. Receives the Next.js `router` for navigation. |
| `clearOnSuccess` | `boolean` | `true` | When `true`, clears the store and resets the form on success. When `false`, preserves values. |
| `className` | `string` | `"flex flex-col gap-4 w-full max-w-sm"` | CSS class for the `<form>` element. |

---

### `<FormyError>` Props

Renders field-specific or global error messages. Merges server errors and client-side validation errors. Zero layout shift by default (absolute positioning).

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `field` | `string` | `undefined` | Target input name. Omit for the global error. |
| `validate` | `(value: string) => string \| null` | `undefined` | Client-side validator. Must be defined in a `'use client'` module. |
| `below` | `boolean` | `false` | Positions the error below the input. Default is above. |
| `absolute` | `boolean` | `true` | Absolute positioning to prevent layout shifts. Set `false` for in-flow rendering. |
| `hasHelp` | `boolean` | `false` | Shows an interactive info icon with a tooltip next to the error. |
| `helpText` | `string` | `""` | Static text inside the glassmorphism help tooltip. |
| `parseMessage` | `(msg: string) => { title: string; info: string }` | `undefined` | Splits one error string into a short title and a detailed tooltip body. |

---

### `<FormySubmit>` Props

Extends all standard `<button>` props. Automatically disables and shows loading text while the action is pending. Uses `useFormStatus` from `react-dom` — works inside any `<form>` with a React 19 action, not only inside `<Formy>`.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `loadingLabel` | `string` | `undefined` | Button label while `isPending` is true. |

---

### `<FormySuccess>` Props

Renders children only when `state` contains the `data` discriminant.

| Prop | Type | Description |
| :--- | :--- | :--- |
| `children` | `ReactNode` | Content to show on success. |

---

### `useFormyActionState<State>(action, initialState)`

Wraps React 19's `useActionState`. Safely handles both Server Action functions and plain URL strings. Throws a developer-friendly error if the action type changes dynamically (which would violate React's Rules of Hooks).

**Returns:** `[state, dispatch, isPending]`

---

### `usePersistedForm<Store>(getState, formId)`

Hook that reads and writes a single form's persisted values from any store conforming to `FormyStoreSlice`.

**Returns:** `FormyPersistAdapter` — `{ getValues, setValue, clear }`

> Intended to be used via `createPersistBridge` — you rarely need to call this directly.

---

### `createPersistBridge<Store>(useGetState)`

Factory that connects any store conforming to `FormyStoreSlice` to `FormyPersistContext`. Returns a `<FormyPersistBridge>` Provider component.

Internally uses `usePersistedForm.bind(null, getState)` to pass a store-bound hook as the context value without an extra wrapper.

**`FormyStoreSlice` contract:**
```tsx
interface FormyStoreSlice {
    forms: Record<string, Record<string, string>>;
    setFormValue: (formId: string, name: string, value: string) => void;
    clearForm: (formId: string) => void;
}
```

---

### `FormyActionState` Type

The base constraint for all Formy action return types.

```tsx
type FormyActionState =
    | { error: string | Record<string, string> | null }
    | { data: unknown };
```

---

## Requirements

- **Next.js** `^16.0.0`
- **React** `^19.0.0`
- **react-dom** `^19.0.0`
- **zustand** `^5.0.0` (if using the default Zustand bridge)

---

## License

MIT
