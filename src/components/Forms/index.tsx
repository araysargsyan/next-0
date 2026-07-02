'use client'
import React, { ReactNode, ComponentProps, useActionState, useEffect, useState } from "react";

// Custom wrapper hook to conditionally execute action state (Zero type assertions!)
export function useFormyActionState<State>(
    action: string | ((state: Awaited<State> | undefined, payload: FormData) => State | Promise<State>) | undefined,
    initialState: Awaited<State> | undefined
): [state: Awaited<State> | undefined, dispatch: string | undefined | ((payload: FormData) => void), isPending: boolean | undefined] {
    const isFunction = typeof action === "function";
    
    // Store the initial action type on mount using useState (fully safe to read during render)
    const [initialIsFunction] = useState(isFunction);

    // If it changes during the lifecycle, throw a clear developer error
    if (initialIsFunction !== isFunction) {
        throw new Error(
            `Formy: The action prop type cannot be changed dynamically from ${
                initialIsFunction ? "a function" : "a string/undefined"
            } to ${isFunction ? "a function" : "a string/undefined"} during the lifecycle of the component.`
        );
    }

    if (typeof action === "function") {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useActionState(action, initialState);
    } else {
        return [undefined, action, undefined]
    }
}

interface FormyProps<State> extends Omit<ComponentProps<"form">, "children" | "action"> {
    action?: string | ((state: Awaited<State> | undefined, payload: FormData) => State | Promise<State>);
    initialState?: Awaited<State>;
    children?: ReactNode | ((state: Awaited<State> | undefined, isPending: boolean) => ReactNode);
    onStateChange?: (state: Awaited<State> | undefined) => void;
    submitLabel?: string;
    loadingLabel?: string;
}

export default function Formy<State = unknown>({
    action,
    initialState,
    children,
    onStateChange,
    className = "flex flex-col gap-4 w-full max-w-sm",
    submitLabel,
    loadingLabel = "Loading...",
    ...props
}: FormyProps<State>) {
    // Run the wrapper hook
    const [state, formAction, isPending] = useFormyActionState<State>(
        action,
        initialState
    );

    const resolvedState = state !== undefined ? state : initialState;
    const resolvedFormAction = formAction || "";
    const resolvedIsPending = !!isPending;

    // Call onStateChange callback if present
    useEffect(() => {
        if (onStateChange && state !== undefined) {
            onStateChange(state);
        }
    }, [state, onStateChange]);

    return (
        <form 
            action={resolvedFormAction} 
            className={className} 
            {...props}
        >
            {typeof children === "function" ? children(resolvedState, resolvedIsPending) : children}
            {submitLabel && (
                <button
                    type="submit"
                    disabled={resolvedIsPending}
                    className="bg-black text-white rounded-lg px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                    {resolvedIsPending ? loadingLabel : submitLabel}
                </button>
            )}
        </form>
    );
}
