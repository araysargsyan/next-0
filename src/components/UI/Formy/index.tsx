"use client";

import { useEffect, useRef, useContext, SubmitEvent, InputEvent } from "react";
import { useRouter } from "next/navigation";
import Form from "next/form";
import { FormyActionState, StrictFormyState, FormyProps } from "./types";
import { FormyContext } from "./FormyContext";
import { useFormyActionState } from "./useFormyActionState";
import {FormStoreContext, useFormStore} from "@/components/Providers/FormStoreProvider";

export * from "./types";
export * from "./FormyContext";
export * from "./useFormyActionState";
export * from "./FormySubmit";
export * from "./FormySuccess";

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    const nativeSetter = descriptor ? descriptor.set : null;

    if (nativeSetter) {
        nativeSetter.call(element, value);
        const event = new Event("input", { bubbles: true });
        element.dispatchEvent(event);
    } else {
        element.value = value;
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

    const formRef = useRef<HTMLFormElement>(null);
    const savedValues = useRef<Record<string, string>>({});
    const isRestoring = useRef(false);
    const prevIsPending = useRef(resolvedIsPending);

    // Zustand integration
    const id = props.id;
    const store = useContext(FormStoreContext);
    const storeValues = useFormStore((s) => (id ? s.forms[id] : undefined));
    const setFormValue = useFormStore((s) => s.setFormValue);
    const clearForm = useFormStore((s) => s.clearForm);

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    // Restore form values from the global store on mount
    useEffect(() => {
        if (id && store && formRef.current) {
            const initialValues = store.getState().forms[id];
            if (initialValues && Object.keys(initialValues).length > 0) {
                isRestoring.current = true;
                const inputs = formRef.current.querySelectorAll("input, textarea, select");
                inputs.forEach((input) => {
                    const htmlInput = input as HTMLInputElement;
                    const name = htmlInput.name;
                    if (name && initialValues[name] !== undefined) {
                        setNativeValue(htmlInput, initialValues[name]);
                    }
                });
                isRestoring.current = false;
            }
        }
    }, [id, store]);

    // Restore form values after Action/RSC Refresh resets them on error
    useEffect(() => {
        if (resolvedState && "success" in resolvedState && resolvedState.success) {
            if (id) {
                clearForm(id);
            }
            savedValues.current = {};
            prevIsPending.current = resolvedIsPending;
            return;
        }

        const didTransitionEnd = prevIsPending.current && !resolvedIsPending;
        prevIsPending.current = resolvedIsPending;

        if (didTransitionEnd) {
            const valuesToRestore = id && storeValues ? storeValues : savedValues.current;
            if (formRef.current && Object.keys(valuesToRestore).length > 0) {
                isRestoring.current = true;
                const inputs = formRef.current.querySelectorAll("input, textarea, select");
                inputs.forEach((input) => {
                    const htmlInput = input as HTMLInputElement;
                    const name = htmlInput.name;
                    if (name && valuesToRestore[name] !== undefined) {
                        setNativeValue(htmlInput, valuesToRestore[name]);
                    }
                });
                isRestoring.current = false;
            }
        }
    }, [resolvedState, resolvedIsPending, id, storeValues, clearForm]);

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

    const handleInput = (e: InputEvent<HTMLFormElement>) => {
        if (isRestoring.current) return;
        if (id) {
            const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (target && target.name && target.type !== "file") {
                setFormValue(id, target.name, target.value);
            }
        }
        if (props.onInput) {
            props.onInput(e);
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
                onInput={handleInput}
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
