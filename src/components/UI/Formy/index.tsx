'use client'
import { useEffect, useRef, SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Form from "next/form";
import { FormyActionState, StrictFormyState, FormyProps } from "./types";
import { FormyContext } from "./FormyContext";
import { useFormyActionState } from "./useFormyActionState";

export * from "./types";
export * from "./FormyContext";
export * from "./useFormyActionState";
export * from "./FormySubmit";
export * from "./FormySuccess";

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

    const formRef = useRef<HTMLFormElement>(null);
    const savedValues = useRef<Record<string, string>>({});

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    // Restore form values after Action/RSC Refresh resets them on error
    useEffect(() => {
        if (resolvedState && "success" in resolvedState && resolvedState.success) {
            savedValues.current = {};
            return;
        }

        if (!resolvedIsPending && formRef.current && Object.keys(savedValues.current).length > 0) {
            const inputs = formRef.current.querySelectorAll("input, textarea, select");
            inputs.forEach((input) => {
                const htmlInput = input as HTMLInputElement;
                const name = htmlInput.name;
                if (name && savedValues.current[name] !== undefined) {
                    htmlInput.value = savedValues.current[name];
                }
            });
        }
    }, [resolvedState, resolvedIsPending]);

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            const values: Record<string, string> = {};
            formData.forEach((val, key) => {
                if (typeof val === "string") {
                    values[key] = val;
                }
            });
            savedValues.current = values;
        }
        if (props.onSubmit) {
            props.onSubmit(e);
        }
    };

    return (
        <FormyContext.Provider value={{ state: resolvedState, isPending: resolvedIsPending }}>
            <Form
                ref={formRef}
                action={resolvedFormAction}
                className={className}
                {...props}
                onSubmit={handleSubmit}
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
            </Form>
        </FormyContext.Provider>
    );
}
