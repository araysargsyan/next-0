"use client";

import { useContext, useEffect, useRef } from "react";
import type { SubmitEvent, InputEvent } from "react";
import { useRouter } from "next/navigation";
import Form from "next/form";
import type { FormyActionState, StrictFormyState, FormyProps } from "./types";
import { FormyContext } from "./FormyContext";
import { FormyPersistContext } from "./FormyPersistContext";
import { useFormyActionState } from "./useFormyActionState";

export * from "./types";
export * from "./FormyContext";
export * from "./FormyPersistContext";
export * from "./createPersistBridge";
export * from "./useFormyActionState";
export * from "./FormySubmit";
export * from "./FormySuccess";

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    const nativeSetter = descriptor ? descriptor.set : null;

    if (nativeSetter) {
        nativeSetter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
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
    clearOnSuccess = true,
    ...props
}: FormyProps<State>) {
    const router = useRouter();
    const [state, formAction, isPending] = useFormyActionState<State>(action, initialState);

    const resolvedState = state;
    const resolvedFormAction = formAction || "";
    const resolvedIsPending = !!isPending;

    const formRef = useRef<HTMLFormElement>(null);
    const savedValues = useRef<Record<string, string>>({});
    const isRestoring = useRef(false);
    const prevIsPending = useRef(resolvedIsPending);
    const hasHydrated = useRef(false);

    // Достаём persist-хук из контекста (реальная реализация или no-op заглушка)
    // и сразу вызываем его — безусловно, ровно как требуют Rules of Hooks.
    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");
    const persistRef = useRef(persist);

    function restoreFromValues(formEl: HTMLFormElement, values: Record<string, string>) {
        if (Object.keys(values).length === 0) return;
        formEl.querySelectorAll("input, textarea, select").forEach((el) => {
            const input = el as HTMLInputElement;
            if (input.name && values[input.name] !== undefined) {
                setNativeValue(input, values[input.name]);
            }
        });
    }

    useEffect(() => {
        persistRef.current = persist;
    });

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    // Гидратация значений из persist-адаптера при монтировании (один раз)
    useEffect(() => {
        if (hasHydrated.current) return;
        hasHydrated.current = true;

        if (persist.values && formRef.current && Object.keys(persist.values).length > 0) {
            isRestoring.current = true;
            formRef.current.querySelectorAll("input, textarea, select").forEach((el) => {
                const input = el as HTMLInputElement;
                if (input.name && persist.values![input.name] !== undefined) {
                    setNativeValue(input, persist.values![input.name]);
                }
            });
            isRestoring.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Восстановление значений после того, как action отработал (RSC/Server Action reset)
    useEffect(() => {
        if (resolvedState && "success" in resolvedState && resolvedState.success) {
            if (clearOnSuccess) {
                persistRef.current.clear();
                savedValues.current = {};
            } else if (formRef.current) {
                isRestoring.current = true;
                restoreFromValues(formRef.current, persistRef.current.values ?? savedValues.current);
                isRestoring.current = false;
            }
            prevIsPending.current = resolvedIsPending;
            return;
        }

        const didTransitionEnd = prevIsPending.current && !resolvedIsPending;
        prevIsPending.current = resolvedIsPending;

        if (didTransitionEnd && formRef.current) {
            isRestoring.current = true;
            restoreFromValues(formRef.current, persistRef.current.values ?? savedValues.current);
            isRestoring.current = false;
        }
    }, [resolvedState, resolvedIsPending, clearOnSuccess]);

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
        props.onSubmit?.(e);
    };

    const handleInput = (e: InputEvent<HTMLFormElement>) => {
        if (isRestoring.current) return;
        const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (target?.name && target.type !== "file") {
            persist.setValue(target.name, target.value);
        }
        props.onInput?.(e);
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
