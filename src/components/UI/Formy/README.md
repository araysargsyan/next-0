# Formy Component System

`Formy` is a generic, type-safe Next.js wrapper around React 19's `useActionState` and standard HTML `<form>` elements. It is designed to bridge the boundary between **React Server Components (RSC)** and **Client Components**, enabling high-performance, non-hydrated forms with custom browser event logic.

---

## Key Features

1. **RSC Composition Pattern**: Allows child input fields to remain 100% static HTML (rendering on the server, zero client hydration weight) while wrapping them in client-side submit/state behaviors.
2. **Type Assertion Free**: Fully integrates with React 19's promise unwrapping (`Awaited<State>`) without using any `as` type assertions or runtime bypasses.
3. **Action Type Safeguards**: Detects and throws clean developer errors if a form's action is dynamically switched from a function to a string (or vice-versa) during the component's lifecycle, preventing React hook-ordering crashes.
4. **Boilerplate Reduction**: Encapsulates form actions, loading transitions, and submission callbacks in a simple declarative API.

---

## Folder Structure

```
src/components/UI/Formy/
├── index.tsx          # Core component and hook entry, exports types/context
├── FormyContext.ts    # Shared Formy context
├── FormyError.tsx     # Custom error display component
├── types.ts           # Type definitions
└── README.md          # This documentation
```

---

## Usage Patterns

### Pattern A: Static Server Form with Client Handlers (Recommended)
Use this pattern to keep 100% of your input fields and layout static (non-hydrated). Client-side events (like writing to `localStorage` on submit) are kept in a separate Client Reference file.

#### 1. Define Client Event Handlers (e.g. `handlers.tsx`)
```tsx
'use client'

export const submitHandler = () => {
    localStorage.setItem("was_logged_in", "true");
};
```

#### 2. Compose the Form in a Server Component (e.g. `index.tsx`)
```tsx
import Formy from "@/components/UI/Formy";
import { signInAction } from "@/app/sign-in/actions";
import { submitHandler } from "./handlers"; // Imported as a serializable Client Reference!

export default function LoginForm() {
    return (
        <Formy
            action={signInAction}
            onSubmit={submitHandler}
            submitLabel="Sign in"
            loadingLabel="Signing in..."
        >
            <input name="email" type="email" required />
            <input name="password" type="password" required />
        </Formy>
    );
}
```

---

### Pattern B: Interactive Form with Render Functions
Use this pattern if the layout of your inputs needs to change dynamically in the browser based on the form state (e.g., displaying error text, disabling inputs when pending).

```tsx
'use client'

import Formy from "@/components/UI/Formy";
import { uploadImagesAction } from "@/app/(home)/actions";

export default function ImageUploadForm() {
    return (
        <Formy action={uploadImagesAction}>
            {(state, isPending) => (
                <>
                    <input name="name" type="text" disabled={isPending} />
                    <button type="submit" disabled={isPending}>Submit</button>
                    {state?.error && <p className="error">{state.error}</p>}
                </>
            )}
        </Formy>
    );
}
```

---

## API Reference

### `FormyProps<State>`

`Formy` extends the standard HTML `<form>` attributes, omitting only `children` and `action` to support type-safe generics.

| Prop | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `action` | `string \| ((state: Awaited<State> \| undefined, payload: FormData) => State \| Promise<State>)` | No | A Server Action (function) or standard endpoint (string url) for form submissions. |
| `initialState` | `Awaited<State>` | No | The initial state passed to `useActionState` before submission. |
| `children` | `ReactNode \| ((state: Awaited<State> \| undefined, isPending: boolean) => ReactNode)` | Yes | Form fields. Can be standard JSX elements, or a render function receiving the runtime state. |
| `onStateChange` | `(state: Awaited<State> \| undefined) => void` | No | Client-side callback triggered whenever the state returned from the Server Action updates. |
| `submitLabel` | `string` | No | Text to display on the default submit button. If omitted, no default button is rendered. |
| `loadingLabel` | `string` | No | Text to display on the submit button while `isPending` is true. Defaults to `"Loading..."`. |
