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

Formy's core architectural goal is to keep your `<input>` elements as **React Server Components (RSC)** — pure static HTML with zero JS hydration weight. The `<Formy>` orchestrator acts as the client boundary, while all children (inputs, labels, layout markup) remain server-rendered static HTML and are never compiled into the client-side JavaScript bundle.

To achieve this, Formy intercepts the form's `onSubmit` event to **snapshot all input values** before the Server Action fires. After the action completes on error, it **imperatively restores those values directly in the DOM** — bypassing React 19's automatic `form.reset()`.

Formy guarantees zero unnecessary re-renders — typing in one input or receiving a server validation error *never* triggers a re-render of the parent component or sibling inputs.

Formy automatically optimizes its bundle footprint: controlled forms (render-prop `children`) load zero DOM restoration code, while uncontrolled RSC forms dynamically load only the necessary DOM layer. Use `plainMode` for forms that don't need Server Actions at all.

For cross-navigation persistence, Formy integrates with an optional global store (Zustand by default) via a **store-agnostic bridge** — so your store choice doesn't matter.

This means:
- Your `<input>` fields can stay in a **Server Component** (pure static HTML, zero JS hydration weight).
- On error, the user's typed values are preserved automatically.
- On success, the cache is cleared and the form resets cleanly.

> For architecture details, implementation decisions, and SSR analysis, see [Technical Documentation](./TECHNICAL.md).

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

### Pattern B: Render-prop Children (Controlled Mode)

Pass a function as `children` to access action `state` and `isPending` directly. For controlled mode, use `<FormyInput>` to get automatic error clearing and client-side validation support:

```tsx
import Formy, { FormyInput, FormySubmit } from '@/libs/formy';

<Formy action={submitAction}>
    {(state, isPending) => (
        <>
            <FormyInput
                name="username"
                type="text"
                value={username}
                onInput={(e) => setUsername(e.currentTarget.value)}
                validate={(val) => val ? null : "Username is required"}
            />
            {isPending && <p>Submitting...</p>}
            {state && 'data' in state && <p>Done!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

> **Note:** The `state` received by render-prop children is the raw Server Action state (`Awaited<State> | null`), not merged with client errors. `<FormyInput>` handles client error display internally.

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

### Pattern I: Third-party UI Components (Shadcn / Radix)

Shadcn and Radix UI components (e.g. `Select`, `Checkbox`, `Switch`) are always Client Components — they require JavaScript for interactivity and accessibility (keyboard navigation, ARIA). They cannot be used as static RSC children.

Use `useErrorsContext` to connect any custom component to Formy's error system. It gives you the current field error and `clearFieldError` — without duplicating event logic at the form level.

```tsx
// components/CountrySelect.tsx
'use client'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useErrorsActionsContext } from "@/libs/formy";
import { FormyError } from "@/libs/formy";

interface CountrySelectProps {
    name: string;
    defaultValue?: string;
}

export function CountrySelect({ name, defaultValue }: CountrySelectProps) {
    const { clearFieldError } = useErrorsActionsContext();

    return (
        <div className="relative">
            <Select
                name={name}
                defaultValue={defaultValue}
                onValueChange={() => clearFieldError?.(name)}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="de">Germany</SelectItem>
                </SelectContent>
            </Select>
            <FormyError field={name} below />
        </div>
    );
}
```

Drop it directly inside a `<Formy>` form — no extra wiring needed:

```tsx
<Formy id="profile-form" action={profileAction}>
    <CountrySelect name="country" />
    <FormySubmit>Save</FormySubmit>
</Formy>
```

> **Note:** `useErrorsContext` must be called inside a component that is rendered within a `<Formy>` boundary. Calling it outside will throw a developer-friendly error.

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
| `plainMode` | `boolean` | `false` | When `true`, bypasses dynamic loading of `FormyCore` and renders a plain `<form>`/`<Form>`. Ideal for forms without Server Actions. |

---

### `<FormyError>` Props

Renders field-specific or global error messages. Merges server errors and client-side validation errors. Zero layout shift by default (absolute positioning).

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `field` | `string` | `undefined` | Target input name. Omit for the global error. |
| `validate` | `(value: string) => string \| null` | `undefined` | Client-side validator. Must be defined in a `'use client'` module. |
| `below` | `boolean` | `false` | Positions the error below the input. Default is above. |
| `absolute` | `boolean` | `true` | Absolute positioning to prevent layout shifts. Set `false` for in-flow rendering. |
| `helpText` | `string` | `undefined` | Static text inside the glassmorphism help tooltip. (Mutually exclusive with `parseMessage`) |
| `parseMessage` | `(msg: string) => { title: string; info?: string }` | `undefined` | Splits one error string into a short title and a detailed tooltip body. (Mutually exclusive with `helpText`, `info` is optional) |

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

### `useErrorsContext(name)`

Hook for integrating custom or third-party UI components (e.g. Shadcn, Radix) with Formy's error system. Must be called inside a component rendered within a `<Formy>` boundary.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | The field name to subscribe to. Matches the `name` attribute of the corresponding input. |

**Returns:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `error` | `string \| null` | The current error message for this field (server or client). Automatically reactive — re-renders only when this specific field's error changes. |
| `clearFieldError` | `(name: string) => void \| undefined` | Clears the error for the given field. Call on `onValueChange` / `onChange` to dismiss errors when the user interacts. |
| `registerValidator` | `fn \| undefined` | Low-level validator registration. Prefer the `validate` prop on `<FormyError>` instead. |

> See [Pattern I](#pattern-i-third-party-ui-components-shadcn--radix) for a full usage example.

---

### `useErrorsActionsContext()`

A lightweight alternative to `useErrorsContext` when you only need helper methods like `clearFieldError` and do not need to read the reactive `error` state. Calling this hook does **not** trigger component re-renders when the form's error state changes.

**Returns:** `{ clearFieldError, registerValidator }`

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
