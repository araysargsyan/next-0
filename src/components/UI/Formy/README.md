# Formy Component System

`Formy` is a generic, type-safe Next.js wrapper around React 19's `useActionState` and standard HTML `<form>` elements. It is designed to bridge the boundary between **React Server Components (RSC)** and **Client Components**, enabling high-performance, non-hydrated forms with custom browser event logic.

---

## Key Features

1. **RSC Composition Pattern**: Allows child input fields to remain 100% static HTML (rendering on the server, zero client hydration weight) while wrapping them in client-side submit/state behaviors.
2. **Strict Null State**: Enforces `null` instead of `undefined` as the explicit initial/default value for props, states, and contexts to guarantee clean Type narrowing.
3. **Type Assertion Free**: Fully integrates with React 19's promise unwrapping (`Awaited<State>`) without using any `as` type assertions or runtime bypasses.
4. **Action Type Safeguards**: Detects and throws clean developer errors if a form's action is dynamically switched from a function to a string (or vice-versa) during the component's lifecycle, preventing React hook-ordering crashes.
5. **Robust Error Subsystem**: Encapsulates field-specific and global error banners via `FormyError` supporting animations, custom text formatting, and interactive help tooltips.
6. **DOM-level Restoration for Uncontrolled Inputs**: React 19's `form.reset()` and Next.js post-action RSC refresh can reset uncontrolled inputs (`defaultValue`) on validation error. `Formy` automatically buffers and restores these input values directly in the DOM on failure, keeping inputs static/uncontrolled while preserving user state.

---

## Folder Structure

```
src/components/UI/Formy/
├── index.tsx                # Core component
├── FormyContext.ts          # Shared Formy context
├── FormyError.tsx           # Custom error display component
├── FormySubmit.tsx          # Client-side submit button
├── FormySuccess.tsx         # Success state wrapper
├── useFormyActionState.ts   # React 19 useActionState logic wrapper
├── types.ts                 # Type definitions
└── README.md                # This documentation
```

---

## Usage Patterns

### Pattern A: Static Server Form with Client Handlers (Recommended)
Use this pattern to keep 100% of your input fields and layout static (non-hydrated). Client-side events (like writing to `localStorage` on submit) are kept in a separate Client Reference file.

#### 1. Define Client Event Handlers (e.g. `handlers.tsx`)
```tsx
'use client'

import { useRouter } from "next/navigation";
import { FormyActionState } from "@/components/UI/Formy";

export const handleStateChange = (
    state: FormyActionState | null,
    router: ReturnType<typeof useRouter>
) => {
    if (state?.success) {
        localStorage.setItem("was_logged_in", "true");
        router.push("/");
    }
};

export const parsePasswordMessage = (msg: string) => {
    const dotIndex = msg.indexOf(". ");
    if (dotIndex !== -1) {
        return {
            title: msg.slice(0, dotIndex + 1), // "Password is too weak."
            info: msg.slice(dotIndex + 2) // "It must be at least 8 characters..."
        };
    }
    return { title: msg, info: "" };
};
```

#### 2. Compose the Form in a Server Component (e.g. `index.tsx`)
```tsx
import Formy from "@/components/UI/Formy";
import FormyError from "@/components/UI/Formy/FormyError";
import { FormySubmit } from "@/components/UI/Formy";
import { signInAction } from "@/app/sign-in/actions";
import { handleStateChange, parsePasswordMessage } from "./handlers"; // Client Reference!

export default function LoginForm() {
    return (
        <Formy
            action={signInAction}
            className="flex flex-col"
            onStateChange={handleStateChange}
        >
            <div className="relative mb-6">
                <input name="email" type="email" required className="w-full border px-4 py-2" />
                <FormyError field="email" below />
            </div>

            <div className="relative mb-8">
                <input name="password" type="password" required className="w-full border px-4 py-2" />
                <FormyError 
                    field="password" 
                    below 
                    hasHelp
                    parseMessage={parsePasswordMessage}
                />
            </div>

            {/* Relative Wrapper for Global Error and Submit Button */}
            <div className="relative">
                <FormyError />
                <FormySubmit
                    loadingLabel="Signing in..."
                    className="w-full bg-black text-white rounded-lg px-4 py-2"
                >
                    Sign in
                </FormySubmit>
            </div>
        </Formy>
    );
}
```

---

## Error Handling (`FormyError`)

`FormyError` handles error rendering dynamically, and is **100% CSS-driven** (no `useLayoutEffect`, `useRef`, or `useState` measurements are used, ensuring zero layout shifts and maximum performance):

* **Field-level Errors**: Adding the `field` prop filters the form state to only display error arrays associated with that specific input name. Setting the `below` prop positions the error absolutely under the relative input container via CSS `translateY(4px)` relative to the container's `top: 100%` bottom edge.
* **Global Errors**: Omitting the `field` prop catches root-level exception messages (e.g., "Invalid email or password"). It renders absolutely at `top: 0` and is shifted up by its height via `translateY(calc(-100% - 4px))` relative to its nearest `relative` wrapper (like the wrapper for the submit button). This prevents any layout shifts and page header collisions.
* **Help Tooltips**: Setting `hasHelp` displays an info icon next to the error text. Hovering over it fades and scales in a glassmorphism styled popup containing detailed requirements (e.g. password criteria parsed using `parseMessage`).

---

## API Reference

### `FormyProps<State>`

`Formy` extends the standard HTML `<form>` attributes, omitting only `children` and `action`.

| Prop | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `action` | `string \| ((state: Awaited<State> \| null, payload: FormData) => State \| Promise<State>)` | No | `undefined` | A Server Action (function) or standard endpoint (string url) for form submissions. |
| `initialState` | `Awaited<State> \| null` | No | `null` | The initial state passed to `useActionState` before submission. |
| `children` | `ReactNode \| ((state: Awaited<State> \| null, isPending: boolean) => ReactNode)` | Yes | `undefined` | Form fields. Can be standard JSX elements, or a render function receiving the runtime state. |
| `onStateChange` | `(state: Awaited<State> \| null, router: ReturnType<typeof useRouter>) => void` | No | `undefined` | Client-side callback triggered whenever the state returned from the Server Action updates. |
| `submitLabel` | `string` | No | `undefined` | Text to display on the default submit button. If omitted, no default button is rendered. |
| `loadingLabel` | `string` | No | `"Loading..."` | Text to display on the submit button while `isPending` is true. |

---

### `FormyErrorProps`

`FormyError` is used to display either field-specific validation errors or global form exceptions.

| Prop | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `field` | `string` | No | `undefined` | The name of the input field to capture validation errors for. If omitted, handles global exceptions. |
| `below` | `boolean` | No | `false` | If true, positions the error below the input container (`top: 100%`). If false, positions it above (`top: 0`). |
| `hasHelp` | `boolean` | No | `false` | Displays an interactive info icon next to the error text. |
| `helpText` | `string` | No | `""` | Content to display inside the hoverable glassmorphism tooltip popup. |
| `parseMessage` | `(message: string) => { title: string; info: string }` | No | `undefined` | A callback to split a single error string into a short title and a detailed tooltip description. |
| `absolute` | `boolean` | No | `true` | If true, uses absolute positioning to prevent layout shifts. If false, renders as a standard block element in-flow. |

---

### `FormySubmitProps`

`FormySubmit` is a custom Client button wrapper that inherits all standard HTML button attributes and automatically handles loading state changes.

| Prop | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `loadingLabel` | `string` | No | `undefined` | Text to display on the button when the form is submitting (`isPending` is true). |

---

### `FormySuccess`

`FormySuccess` is a wrapper component that renders its children only when the form action completes successfully.

| Prop | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `children` | `ReactNode` | Yes | `undefined` | Elements to display when `state.success` is true. |
