# formy-next

> **Zero-hydration Server Action forms for Next.js 16+ and React 19.**
> Keep your inputs on the server. Keep your data on error.

---

## The Problem

When building forms in Next.js 16+ (App Router) and React 19, you face a hard architectural choice between Server Components (RSC) and Client Components:

1. **RSC / Static Elements (Zero Hydration)**: Keep your form markup, inputs, and layout on the server. This yields optimal bundle sizes, zero client-side JS overhead, and instant load times. However, you lose the ability to perform client-side interactivity, live field-level validation, or custom error handling without writing heavy custom boilerplate.
2. **Client Components (`'use client'`)**: Move the entire form tree, its inputs, and styles to the client JS bundle. This enables validation, interactive states, and error handling, but completely defeats the benefits of React Server Components and bloats the page's JS weight.

Furthermore, if you try to keep inputs as Server Components (uncontrolled), you hit a painful React 19 limitation: **`form.reset()` is called automatically after every Server Action completes** — even on validation errors. This wipes all user-typed values, forcing them to start over.

### The Solution: Formy

Formy bridges this gap. It allows you to keep your `<input>` elements as **100% Server Components (RSC)** — they are compiled to HTML on the server and require zero-JS hydration for their layouts. Yet, they retain full client-side interactive capabilities:

- **Automatic Value Restoration (Post-effect)**: On validation errors, user-typed values are preserved seamlessly, bypassing React 19's automatic `form.reset()`.
- **Zero-Rerender Client-Side Validation**: Field-level validation and error reporting without re-rendering the parent form or sibling inputs.
- **Dynamic CSS Transitions**: Error components animate smoothly without unmounting or causing layout shifts.

---

## How It Works

Formy's core architectural goal is to preserve user-typed values across Server Action roundtrips — with zero unnecessary re-renders.

Here is the underlying mechanism:

1. **Server Rendering**: Each `<FormyInput>` is compiled and rendered once on the server as a native HTML `<input>` element with a `data-formy-input` attribute (keeping layout and static props out of the client JS bundle).
2. **Client-Side Interactivity Overlay**: Under the default **`staticMode={true}`**, Formy dynamically loads the `FormyRestoreEngine` on the client, which sets up form-wide event delegation for all inputs marked with `data-formy-input`.
3. **Local Value Tracking**: Formy tracks the user's typed input values using a form-level in-memory reference map rather than form-wide React state, preventing typing from triggering any parent or sibling re-renders.
4. **Post-Action Restoration**: After a Server Action completes, the restoration engine directly restores the tracked values to the DOM elements. This happens synchronously before the browser paints (`useLayoutEffect`), eliminating any visual flickering.

By using this approach, Formy guarantees **zero unnecessary re-renders** — typing in a field or rendering a server validation error *never* triggers a re-render of the parent form or sibling inputs. Only the specific `<FormyError>` for the affected field re-renders.

When `staticMode={false}` is set on `<Formy>`, the dynamic value restoration logic is bypassed entirely, rendering plain HTML inputs with zero additional client-side scripting.

> For internal architecture details, implementation decisions, and SSR analysis, see [Technical Documentation](./TECHNICAL.md).

---

## Quick Start

### 1. Define a Server Action

```tsx
// app/sign-in/actions.ts
'use server'

import type { FormyActionState } from 'formy-next';

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
import Formy, { FormyInput, FormyError, FormySubmit } from 'formy-next';
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

## Core Integration Scenarios

Formy supports four main usage scenarios depending on your rendering strategy and third-party UI library requirements:

### Scenario 1: Pure RSC Uncontrolled Mode (Default)
- **Concept:** Both the form layout and the input elements are React Server Components (RSC) rendering static HTML.
- **How it works:** You use the built-in `<FormyInput>` component. Formy handles DOM-level value restoration on the client dynamically after a Server Action error.
- **Example:**
  ```tsx
  import Formy, { FormyInput, FormySubmit } from 'formy-next';
  import { myAction } from './actions';

  export default function MyForm() {
      return (
          <Formy action={myAction}>
              <FormyInput name="email" type="email" />
              <FormySubmit>Submit</FormySubmit>
          </Formy>
      );
  }
  ```

### Scenario 2: RSC Mode with Third-Party UI Components (Shadcn / Radix / MUI)
- **Concept:** The parent form is an RSC, but the specific inputs are Client Components from a library (like Shadcn `<Select>` or Radix `<Checkbox>`).
- **How it works:** Wrap the library component in a thin `'use client'` wrapper. Use `useFormyErrors` and local state/refs to persist/restore values and clear errors on interaction.
- **Example (Text Input):**
  ```tsx
  // components/CustomRscInput.tsx — 'use client'
  'use client';
  import { useState, useContext, useLayoutEffect, useRef } from 'react';
  import { Input as LibraryInput } from "@/components/ui/input";
  import { FormyContext, FormyModeContext } from 'formy-next/contexts';
  import { useFormyErrors, FormyError } from 'formy-next';

  export function CustomRscInput({ name, placeholder }: { name: string; placeholder?: string }) {
      const { state } = useContext(FormyContext);
      const { clearOnSuccess } = useContext(FormyModeContext);
      const { clearFieldError } = useFormyErrors(name);

      const [value, setValue] = useState('');
      const savedValue = useRef('');

      useLayoutEffect(() => {
          if (state && 'data' in state && clearOnSuccess) {
              setValue('');
              savedValue.current = '';
              return;
          }
          if (savedValue.current && value !== savedValue.current) {
              setValue(savedValue.current);
          }
      }, [state, clearOnSuccess]);

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          setValue(val);
          savedValue.current = val;
          clearFieldError?.(name);
      };

      return (
          <div className="relative mb-6">
              <LibraryInput name={name} value={value} onChange={handleChange} placeholder={placeholder} />
              <FormyError field={name} below />
          </div>
      );
  }
  ```

- **Example (Select Component):**
  ```tsx
  // components/CustomRscSelect.tsx — 'use client'
  'use client';
  import { useState, useContext, useLayoutEffect, useRef } from 'react';
  import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
  import { FormyContext, FormyModeContext } from 'formy-next/contexts';
  import { useFormyErrors, FormyError } from 'formy-next';

  export function CustomRscSelect({ name }: { name: string }) {
      const { state } = useContext(FormyContext);
      const { clearOnSuccess } = useContext(FormyModeContext);
      const { clearFieldError } = useFormyErrors(name);

      const [value, setValue] = useState('');
      const savedValue = useRef('');

      useLayoutEffect(() => {
          if (state && 'data' in state && clearOnSuccess) {
              setValue('');
              savedValue.current = '';
              return;
          }
          if (savedValue.current && value !== savedValue.current) {
              setValue(savedValue.current);
          }
      }, [state, clearOnSuccess]);

      const handleChange = (newValue: string) => {
          setValue(newValue);
          savedValue.current = newValue;
          clearFieldError?.(name);
      };

      return (
          <div className="relative mb-6">
              <Select name={name} value={value} onValueChange={handleChange}>
                  <SelectTrigger><SelectValue placeholder="Select option" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                  </SelectContent>
              </Select>
              <FormyError field={name} below />
          </div>
      );
  }
  ```

- **Parent Form Usage (Server Component):**
  ```tsx
  // app/page.tsx — Server Component (RSC)
  import Formy, { FormySubmit } from 'formy-next';
  import { CustomRscInput } from '@/components/CustomRscInput';
  import { CustomRscSelect } from '@/components/CustomRscSelect';
  import { myAction } from './actions';

  export default function Page() {
      return (
          <Formy action={myAction}>
              <CustomRscInput name="email" placeholder="Email" />
              <CustomRscSelect name="role" />
              <FormySubmit>Save</FormySubmit>
          </Formy>
      );
  }
  ```


### Scenario 3: Controlled / Render-prop Mode
- **Concept:** Form state is controlled using React state (`useState`) or a custom state manager (Zustand, Redux).
- **How it works:** Pass a function as `children` to access `state` and `isPending`. Inputs are bound controlled via `value` and `onChange`. DOM-level restoration is automatically bypassed.
- **Example:**
  ```tsx
  'use client';
  import { useState } from 'react';
  import Formy, { FormyInput, FormySubmit } from 'formy-next';
  import { submitAction } from './actions';

  export default function ControlledForm() {
      const [username, setUsername] = useState('');

      return (
          <Formy action={submitAction}>
              {(state, isPending) => (
                  <>
                      <FormyInput
                          name="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                      />
                      <FormySubmit>Submit</FormySubmit>
                  </>
              )}
          </Formy>
      );
  }
  ```

### Scenario 4: Non-Static Mode (Bypassing Dynamic Value Restoration)
- **Concept:** You want to render static JSX inputs (ReactNode children) instead of using a controlled render-prop function, but you do not need or want the dynamic restoration script to be downloaded (e.g., for simple search/filter forms or client-side fetch submissions where value preservation on error is not required).
- **How it works:** Set `staticMode={false}` on `<Formy>`. This tells the parent form wrapper to bypass the `<FieldsetBarrier>` and skip loading `FormyRestoreEngine`. The client-side value restoration chunk is **never downloaded or loaded**, keeping the bundle size minimal while retaining client-side validation context on submit.
- **Example:**
  ```tsx
  import Formy, { FormyInput, FormySubmit } from 'formy-next';
  import { handleSearch, notEmpty } from './handlers';

  export default function SearchForm() {
      return (
          <Formy staticMode={false} onSubmit={handleSearch}>
              <FormyInput name="query" placeholder="Search..." />
              <FormyError field="query" validate={notEmpty} />
              <FormySubmit>Search</FormySubmit>
          </Formy>
      );
  }
  ```

---

## Usage Patterns

### Pattern A: Client Callback on Success

Use `onStateChange` to run client-side logic (redirect, `localStorage`, etc.) when the Server Action returns.

**`handlers.ts`** — a separate Client Reference file:

```tsx
'use client'

import { useRouter } from 'next/navigation';
import type { FormyActionState } from 'formy-next';

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

```tsx
import { useRouter } from 'next/navigation';
import Formy from 'formy-next';
import { handleStateChange } from './handlers';
import { signInAction } from './actions';

export default function LoginForm() {
    const router = useRouter();

    return (
        <Formy
            id="login-form"
            action={signInAction}
            onStateChange={(state) => handleStateChange(state, router)}
        >
            {/* ... form fields ... */}
        </Formy>
    );
}
```

### Pattern B: Render-prop Children (Controlled Mode)

Pass a function as `children` to access action `state` and `isPending` directly. Use `<FormyInput>` for automatic value restoration, and `<FormyError>` for client-side validation:

```tsx
'use client'

import { useState } from 'react';
import Formy, { FormyInput, FormyError, FormySubmit } from 'formy-next';
import { submitAction } from './actions';

export default function ControlledForm() {
    const [username, setUsername] = useState('');

    return (
        <Formy action={submitAction}>
            {(state, isPending) => (
                <>
                    <FormyInput
                        name="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <FormyError
                        field="username"
                        validate={(val) => val ? null : "Username is required"}
                    />
                    {isPending && <p>Submitting...</p>}
                    {state && 'data' in state && <p>Done!</p>}
                    <FormySubmit>Submit</FormySubmit>
                </>
            )}
        </Formy>
    );
}
```

> **Note:** The `state` received by render-prop children is the raw Server Action state (`Awaited<State> | null`). Use `<FormyError>` to display and manage field-specific errors.

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
import Formy, { FormyInput, FormySuccess, FormySubmit } from 'formy-next';
import { subscribeAction } from './actions';

export default function SubscribeForm() {
    return (
        <Formy action={subscribeAction}>
            <FormyInput name="email" type="email" placeholder="Your email" required />
            <FormySuccess>
                <p>You are subscribed!</p>
            </FormySuccess>
            <FormySubmit>Subscribe</FormySubmit>
        </Formy>
    );
}
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
import Formy, { FormyInput, FormyError, FormySubmit } from 'formy-next';
import { validateEmail, validatePassword } from './validators';
import { loginAction } from './actions';

export default function LoginForm() {
    return (
        <Formy action={loginAction}>
            <FormyInput name="email" type="email" />
            <FormyError field="email" validate={validateEmail} />
            <FormyInput name="password" type="password" />
            <FormyError field="password" validate={validatePassword} />
            <FormySubmit>Login</FormySubmit>
        </Formy>
    );
}
```

### Pattern F: Checkbox & Radio Support

Checkboxes and radios are fully supported via `<FormyInput>`. Formy restores their checked state after errors.

```tsx
import Formy, { FormyInput, FormySubmit } from 'formy-next';
import { registerAction } from './actions';

export default function RegisterForm() {
    return (
        <Formy action={registerAction}>
            <FormyInput type="checkbox" name="remember" />
            <FormyInput type="radio" name="role" value="admin" />
            <FormyInput type="radio" name="role" value="user" />
            <FormySubmit>Submit</FormySubmit>
        </Formy>
    );
}
```

`FormyRestoreEngine` handles `change` events for checkboxes and radios, caching their `.checked` state or selected values, and restores the correct state after a Server Action error.

### Pattern G: Custom Type-safe State

```tsx
import Formy, { FormyInput, FormySubmit } from 'formy-next';
import type { FormyActionState } from 'formy-next';

type MyState = FormyActionState & {
    data?: { userId: string } | null;
};

export async function myAction(
    _state: MyState | null,
    formData: FormData
): Promise<MyState> {
    return { data: { userId: '123' } };
}

export default function CustomStateForm() {
    return (
        <Formy<MyState> action={myAction}>
            {(state) => (
                <>
                    <FormyInput name="username" />
                    {state && 'data' in state && state.data?.userId && (
                        <p>Welcome, user {state.data.userId}!</p>
                    )}
                    <FormySubmit>Submit</FormySubmit>
                </>
            )}
        </Formy>
    );
}
```

### Pattern H: Third-party UI Components (Shadcn / Radix)

Shadcn and Radix UI components (e.g. `Select`, `Checkbox`, `Switch`) are always Client Components — they require JavaScript for interactivity and accessibility (keyboard navigation, ARIA). They cannot benefit from Formy's automatic `FormyRestoreEngine` restoration directly.

Use `useFormyErrors` to connect any custom component to Formy's error system. It gives you the current field error and `clearFieldError` — without prop-drilling or form-level event duplication.

```tsx
// components/CountrySelect.tsx
'use client'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useFormyErrors, FormyError } from "formy-next";

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
import Formy, { FormySubmit } from 'formy-next';
import { CountrySelect } from './CountrySelect';
import { profileAction } from './actions';

export default function ProfileForm() {
    return (
        <Formy id="profile-form" action={profileAction}>
            <CountrySelect name="country" />
            <FormySubmit>Save</FormySubmit>
        </Formy>
    );
}
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
| `staticMode` | `boolean` | `true` | When `true` (default), loads `FormyRestoreEngine` to handle DOM-level value restoration on Server Action error. When `false`, renders plain inputs directly without dynamic loading. |

---

### `<FormyInput>` Props

Extends all standard `<input>` props. Renders a native `<input>` element with the `data-formy-input` marker attribute so that `FormyRestoreEngine` can restore it.

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
| `registerValidator` | `fn` | Low-level validator registration. Prefer the `validate` prop on `<FormyError>` instead. |
| `runFieldValidation` | `fn` | Manually trigger validation for a field by name. |

> See [Pattern H](#pattern-h-third-party-ui-components-shadcn--radix) for a full usage example.

---

### `useFormyState()`

Hook for accessing the current form state and pending status. Must be called inside a component rendered within a `<Formy>` boundary.

**Returns:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `state` | `FormyActionState \| null` | The current action state returned by the server. |
| `isPending` | `boolean` | Whether the form submission is currently pending. |

---

### `FormyActionState` Type

The base constraint for all Formy action return types.

```tsx
type FormyActionState =
    | { error: string | Record<string, string> | null }
    | { data: unknown }
    | void
    | null;
```

## Formy vs. Alternatives

| Feature / Library | **Formy** | **Conform** | **React Hook Form / TanStack Form** |
| :--- | :--- | :--- | :--- |
| **Input Rendering Mode** | **React Server Components (RSC)** (Zero-JS layout) | React Server Components (RSC) | Client Components only (`'use client'`) |
| **React 19 Auto-Reset Fix** | **Yes** (restores DOM synchronously after reset) | No (wiped by auto-reset before `defaultValue` updates) | Yes (bypassed via controlled state) |
| **Rerender Optimization** | **Surgical** (only affected error field re-renders) | Component-wide | Form-wide or watch-based |
| **Dependencies** | **0 dependencies** | Zero dependencies | Depends on library weight/schemas |

Unlike other RSC-capable libraries (like Conform) which rely on feeding `defaultValue` back into inputs, Formy is built to handle React 19's aggressive post-action form reset. Conform suffers from a timing issue where React's auto-reset wipes inputs before new default values can be bound. Formy sidesteps this by using form-wide event delegation and a synchronous `useLayoutEffect` DOM-level restoration after the reset occurs, ensuring zero data loss and zero input layout hydration.

---

## Requirements

- **Next.js** `^16.0.0`
- **React** `^19.0.0`
- **react-dom** `^19.0.0`

---

## License

MIT
