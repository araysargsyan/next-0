'use client'
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormyActionState, StrictFormyState, FormyProps } from "./types";
import { FormyContext } from "./FormyContext";

export * from "./types";
export * from "./FormyContext";

export function useFormyActionState<State extends FormyActionState>(
    action: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>) | undefined,
    initialState: Awaited<State> | null
): [
    state: Awaited<State> | null,
    dispatch: string | undefined | ((payload: FormData) => void),
    isPending: boolean | null
] {
    const isFunction = typeof action === "function";
    const [initialIsFunction] = useState(isFunction);

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
        return [null, action, null]
    }
}

export default function Formy<State extends FormyActionState & StrictFormyState<State> = FormyActionState>({
    action,
    initialState = null,
    children,
    onStateChange,
    className = "flex flex-col gap-4 w-full max-w-sm",
    submitLabel,
    loadingLabel = "Loading...",
    ...props
}: FormyProps<State>) {
    const router = useRouter();
    const [state, formAction, isPending] = useFormyActionState<State>(
        action,
        initialState
    );

    const resolvedState = state;
    const resolvedFormAction = formAction || "";
    const resolvedIsPending = !!isPending;

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    return (
        <FormyContext.Provider value={{ state: resolvedState, isPending: resolvedIsPending }}>
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
        </FormyContext.Provider>
    );
}
