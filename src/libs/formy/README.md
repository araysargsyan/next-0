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

Formy's core architectural goal is to preserve user-typed values across Server Action roundtrips — with zero unnecessary re-renders.

The `<Formy>` orchestrator acts as the client boundary. Each `<FormyInput>` wraps a native `<input>` in a lightweight client component called `RestoreInputValue`, which:

1. Attaches a `ref` to the underlying `<input>` via `cloneElement`
2. Captures the user's typed value in a local `useRef` on every `onChange`
3. Restores the value via `useLayoutEffect([state])` when the Server Action state changes — synchronously before the browser paints, preventing any visible flash

Formy guarantees zero unnecessary re-renders — typing in one input or receiving a server validation error *never* triggers a re-render of the parent component or sibling inputs. Only the specific `<FormyError>` for the affected field re-renders.

`RestoreInputValue` is loaded lazily via `next/dynamic`. In `plainMode`, it is bypassed entirely — ideal for forms that don't use Server Actions.

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

### 2. Build the Form

No global store setup. No providers. Just import and use.

```tsx
// components/LoginForm.tsx
import Formy, { FormyInput, FormyError, FormySubmit } from '@/libs/formy';
import { signInAction } from '@/app/sign-in/actions';

export default function LoginForm() {
    return (
        <Formy id="login-form" action={signInAction} className="flex flex-col gap-4">

            <FormyInput name="email" type="email" placeholder="Email" required />

            <FormyInput name="password" type="password" placeholder="Password" required />

            <div className="relative">
                <FormyError />
                <FormySubmit loadingLabel="Signing in...">Sign in</FormySubmit>
            </div>

        </Formy>
    );
}
```

That's it. On validation error, the user's values are preserved. On success, the form resets cleanly.

> **Note:** Use `<FormyInput>` instead of a plain `<input>` to get automatic value restoration. A plain `<input>` inside `<Formy>` still submits correctly but its value will be wiped after an error — since there is no `ref` to capture and restore it.

---

## Usage Patterns

### Pattern A: Client Callback on Success

Use `onStateChange` to run client-side logic (redirect, `localStorage`, etc.) when the Server Action returns.

**`handlers.ts`** — a separate Client Reference file:

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
import { useRouter } from 'next/navigation';
import { handleStateChange } from './handlers';

const router = useRouter();

<Formy
    id="login-form"
    action={signInAction}
    onStateChange={(state) => handleStateChange(state, router)}
>
    ...
</Formy>
```

### Pattern B: Render-prop Children (Controlled Mode)

Pass a function as `children` to access action `state` and `isPending` directly. Use `<FormyInput>` for automatic error clearing and client-side validation:

```tsx
import Formy, { FormyInput, FormySubmit } from '@/libs/formy';

<Formy action={submitAction}>
    {(state, isPending) => (
        <>
            <FormyInput
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                validate={(val) => val ? null : "Username is required"}
            />
            {isPending && <p>Submitting...</p>}
            {state && 'data' in state && <p>Done!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

> **Note:** The `state` received by render-prop children is the raw Server Action state (`Awaited<State> | null`). `<FormyInput>` handles client error display internally via its embedded `<FormyError>`.

### Pattern C: Field-specific vs. Global Errors

Your Server Action can return either a single string error or a field-keyed object:

```tsx
// Global error — displayed by <FormyError /> (no `field` prop)
return { error: 'Something went wrong.' };

// Field-specific errors — each displayed by matching <FormyInput name="..." />
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
    <FormyInput name="email" type="email" placeholder="Your email" required />
    <FormySuccess>
        <p>You are subscribed!</p>
    </FormySuccess>
    <FormySubmit>Subscribe</FormySubmit>
</Formy>
```

### Pattern E: Client-side Validation

Use the `validate` prop on `<FormyInput>` for real-time field validation. Validation runs on every keystroke and on submit. If client errors exist at submit time, the Server Action is **not called**.

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

<FormyInput name="email" type="email" validate={validateEmail} />
<FormyInput name="password" type="password" validate={validatePassword} />
```

### Pattern F: Checkbox & Radio Support

Checkboxes and radios are fully supported via `<FormyInput>`. Formy restores their checked state after errors.

```tsx
<FormyInput type="checkbox" name="remember" />
<FormyInput type="radio" name="role" value="admin" />
<FormyInput type="radio" name="role" value="user" />
```

`RestoreInputValue` handles the `onChange` event for checkboxes (`.checked`) and radios (`.checked` + `.value`) and restores the correct state after a Server Action error.

### Pattern G: Custom Type-safe State

```tsx
import type { FormyActionState } from '@/libs/formy';

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
            <FormyInput name="username" />
            {state && 'data' in state && state.data?.userId && <p>Welcome, user {state.data.userId}!</p>}
            <FormySubmit>Submit</FormySubmit>
        </>
    )}
</Formy>
```

### Pattern H: Third-party UI Components (Shadcn / Radix)

Shadcn and Radix UI components (e.g. `Select`, `Checkbox`, `Switch`) are always Client Components — they require JavaScript for interactivity and accessibility (keyboard navigation, ARIA). They cannot benefit from Formy's `RestoreInputValue` restoration directly.

Use `useFormyErrors` to connect any custom component to Formy's error system. It gives you the current field error and `clearFieldError` — without prop-drilling or form-level event duplication.

```tsx
// components/CountrySelect.tsx
'use client'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useFormyErrors } from "@/libs/formy";
import { FormyError } from "@/libs/formy";

interface CountrySelectProps {
    name: string;
    defaultValue?: string;
}

export function CountrySelect({ name, defaultValue }: CountrySelectProps) {
    const { clearFieldError } = useFormyErrors(name);

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

> **Note:** `useFormyErrors` must be called inside a component rendered within a `<Formy>` boundary. Calling it outside will throw a developer-friendly error.

---

## API Reference

### `<Formy>` Props

Extends all standard `next/form` (`<Form>`) props, omitting `children` and `action`.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `undefined` | Form identifier. Currently used for logging. |
| `action` | `string \| ServerAction` | `undefined` | A Server Action function or a URL string for native form submission. |
| `initialState` | `State \| null` | `null` | Initial state passed to `useActionState` before the first submission. |
| `children` | `ReactNode \| ((state, isPending) => ReactNode)` | — | Form content. Accepts JSX or a render-prop function. Render-prop receives the raw `Awaited<State> \| null`. |
| `onStateChange` | `(state) => void` | `undefined` | Client callback fired on every new Server Action state. |
| `clearOnSuccess` | `boolean` | `true` | When `true`, clears the saved values and resets the form on success. When `false`, preserves values. |
| `className` | `string` | `"flex flex-col gap-4 w-full max-w-sm"` | CSS class for the `<form>` element. |
| `plainMode` | `boolean` | `false` | When `true`, renders a plain `<form>`/`<Form>` without loading `RestoreInputValue`. Ideal for forms that don't use Server Actions. |

---

### `<FormyInput>` Props

Extends all standard `<input>` props. Wraps the native input in `RestoreInputValue` (lazy-loaded) for automatic value restoration, and renders an embedded `<FormyError>`.

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | — | Input name. Used for form submission and error binding. |
| `validate` | `(value: string) => string \| null` | `undefined` | Client-side validator. Must be defined in a `'use client'` module. |
| `errorBelow` | `boolean` | `true` | Positions the embedded error below the input. |
| `errorAbsolute` | `boolean` | `true` | Absolute positioning for the embedded error to prevent layout shifts. |
| `errorHelpText` | `string` | `""` | Static text in the glassmorphism help tooltip. |
| `errorParseMessage` | `(msg: string) => { title: string; info?: string }` | `undefined` | Splits one error string into a short title and a detailed tooltip body. |
| `containerClassName` | `string` | `"relative mb-6"` | CSS class for the wrapping `<div>`. |
| `children` | `ReactNode` | `null` | Optional content rendered between the input and the error (e.g. a label). |

---

### `<FormyError>` Props

Renders field-specific or global error messages. Merges server errors and client-side validation errors. Zero layout shift by default (absolute positioning).

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `field` | `string` | `"__global__"` | Target input name. Omit for the global error. |
| `validate` | `(value: string) => string \| null` | `undefined` | Client-side validator. Must be defined in a `'use client'` module. |
| `below` | `boolean` | `false` | Positions the error below the input. Default is above. |
| `absolute` | `boolean` | `true` | Absolute positioning to prevent layout shifts. Set `false` for in-flow rendering. |
| `helpText` | `string` | `undefined` | Static text inside the glassmorphism help tooltip. (Mutually exclusive with `parseMessage`) |
| `parseMessage` | `(msg: string) => { title: string; info?: string }` | `undefined` | Splits one error string into a short title and a detailed tooltip body. (Mutually exclusive with `helpText`) |

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

### `useFormyErrors(name?)`

Hook for integrating custom or third-party UI components (e.g. Shadcn, Radix) with Formy's error system. Must be called inside a component rendered within a `<Formy>` boundary.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | The field name to subscribe to. Matches the `name` attribute of the corresponding input. |

**Returns:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `error` | `string \| null` | The current error for this field (server or client). Re-renders only when *this specific field's* error changes. |
| `clearFieldError` | `(name: string) => void` | Clears the error for the given field. If a global error is active, it is cleared instead. |
| `registerValidator` | `fn` | Low-level validator registration. Prefer the `validate` prop on `<FormyError>` or `<FormyInput>` instead. |
| `runFieldValidation` | `fn` | Manually trigger validation for a field by name. |

> See [Pattern H](#pattern-h-third-party-ui-components-shadcn--radix) for a full usage example.

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

---

## License

MIT
