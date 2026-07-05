"use client";

import { useContext, useEffect, useRef, useCallback } from "react";
import type { SubmitEvent, InputEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Form from "next/form";
import type { FormyActionState, StrictFormyState, FormyProps } from "./types";
import { FormyContext } from "./contexts/FormyContext";
import { FormyPersistContext } from "./contexts/FormyPersistContext";
import { useFormyActionState } from "./hooks/useFormyActionState";
import { setNativeValue, setNativeChecked } from "./utils/domHelpers";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import { createLogger } from "@/lib/logger";

const log = createLogger("Formy", "cyan");

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
    const [state, formAction, isPending, setState] = useFormyActionState<State>(action, initialState);
    const resolvedFormAction = formAction || "";
    const resolvedIsPending = !!isPending;


    const formRef = useRef<HTMLFormElement>(null);
    const savedValues = useRef<Record<string, string>>({});
    const savedFiles = useRef<Record<string, File[]>>({});
    const isRestoring = useRef(false);
    const prevIsPending = useRef(resolvedIsPending);
    const hasHydrated = useRef(false);

    // Client-side validation registry
    const validators = useRef<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>({});

    useIsomorphicLayoutEffect(()=>{
        log(`[${props.id ?? "anonymous"}] 🔄 render`, { state, resolvedIsPending });
    })

    const registerValidator = useCallback((
        name: string,
        validateFn: (value: string) => string | null,
        setErrorFn: (error: string | null) => void
    ) => {
        validators.current[name] = { validate: validateFn, setError: setErrorFn };
        return () => {
            delete validators.current[name];
        };
    }, []);

    const clearFieldError = useCallback((name: string) => {
        setState((prev) => {
            if (!prev || !("error" in prev) || !prev.error) return prev;
            if (typeof prev.error === "string") {
                return { ...prev, error: null };
            }
            if (typeof prev.error === "object") {
                const newError = { ...prev.error };
                delete newError[name];
                return {
                    ...prev,
                    error: Object.keys(newError).length > 0 ? newError : null
                } as typeof prev;
            }
            return prev;
        });
    }, [setState]);

    const resolvedState: FormyActionState | null = state ?? null;

    // Retrieve the persist hook from context (real implementation or no-op stub)
    // and call it unconditionally, as required by the Rules of Hooks.
    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");
    const persistRef = useRef(persist);

    const runFieldValidation = useCallback((name: string, value: string) => {
        const entry = validators.current[name];
        if (entry) {
            const error = entry.validate(value);
            log(`[${props.id ?? "anonymous"}] validate [${name}]:`, error ? `FAILED (${error})` : "PASSED");
            entry.setError(error);
        }
    }, [props.id]);

    const restoreFromValues = useCallback((formEl: HTMLFormElement, values: Record<string, string>) => {
        if (Object.keys(values).length === 0) return;
        log(`[${props.id ?? "anonymous"}] restoring DOM values`, values);
        formEl.querySelectorAll("input, textarea, select").forEach((el) => {
            const input = el as HTMLInputElement;
            if (!input.name || values[input.name] === undefined) return;

            if (input.type === "checkbox") {
                setNativeChecked(input, values[input.name] === "true");
            } else if (input.type === "radio") {
                setNativeChecked(input, input.value === values[input.name]);
            } else if (input.type !== "file") {
                setNativeValue(input, values[input.name]);
            }
        });

        // Restore file inputs from the local ref using DataTransfer
        formEl.querySelectorAll('input[type="file"]').forEach((el) => {
            const fileInput = el as HTMLInputElement;
            const files = savedFiles.current[fileInput.name];
            if (files && files.length > 0) {
                try {
                    const dt = new DataTransfer();
                    files.forEach((file) => dt.items.add(file));
                    fileInput.files = dt.files;
                    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
                } catch (err) {
                    console.error("Formy: failed to restore file input", err);
                }
            }
        });
    }, [props.id]);

    useEffect(() => {
        persistRef.current = persist;
    });

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    // Hydrate field values from the persist adapter on mount (runs once)
    useEffect(() => {
        if (hasHydrated.current) return;
        hasHydrated.current = true;

        const values = persist.getValues();
        if (values && formRef.current && Object.keys(values).length > 0) {
            log(`[${props.id ?? "anonymous"}] mount hydration: restoring from store`, values);
            isRestoring.current = true;
            restoreFromValues(formRef.current, values);
            isRestoring.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore field values after the action completes (RSC / Server Action reset)
    useEffect(() => {
        if (resolvedState && "success" in resolvedState && resolvedState.success) {
            if (clearOnSuccess) {
                log(`[${props.id ?? "anonymous"}] action succeeded, clearing state`);
                persistRef.current.clear();
                savedValues.current = {};
                savedFiles.current = {};
            } else if (formRef.current) {
                log(`[${props.id ?? "anonymous"}] action succeeded, restoring final values`);
                isRestoring.current = true;
                restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValues.current);
                isRestoring.current = false;
            }
            prevIsPending.current = resolvedIsPending;
            return;
        }

        const didTransitionEnd = prevIsPending.current && !resolvedIsPending;
        prevIsPending.current = resolvedIsPending;

        if (didTransitionEnd && formRef.current) {
            log(
                `[${props.id ?? "anonymous"}] transition ended, restoring values`,
                persistRef.current.getValues() ?? savedValues.current
            );
            isRestoring.current = true;
            restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValues.current);
            isRestoring.current = false;
        }
    }, [resolvedState, resolvedIsPending, clearOnSuccess, props.id, restoreFromValues]);

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);

            // Explicitly capture unchecked checkboxes as "false"
            formRef.current.querySelectorAll('input[type="checkbox"]').forEach((el) => {
                const cb = el as HTMLInputElement;
                if (cb.name && !formData.has(cb.name)) {
                    formData.append(cb.name, "false");
                }
            });

            const values: Record<string, string> = {};
            formData.forEach((val, key) => {
                if (typeof val === "string") {
                    values[key] = val;
                }
            });
            savedValues.current = values;

            log(`[${props.id ?? "anonymous"}] submitting form`, values);

            // Run client-side validation on submission
            let hasErrors = false;
            Object.entries(validators.current).forEach(([name, entry]) => {
                const error = entry.validate(savedValues.current[name] ?? "");
                entry.setError(error);
                if (error) {
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                log(`[${props.id ?? "anonymous"}] client validation failed`);
                e.preventDefault();
                return;
            }
        }
        props.onSubmit?.(e);
    };

    const handleInput = (e: InputEvent<HTMLFormElement>) => {
        if (isRestoring.current) return;
        const target = e.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.name) {
                clearFieldError(target.name);
                if (target.type !== "file" && target.type !== "checkbox" && target.type !== "radio") {
                    log(`[${props.id ?? "anonymous"}] input [${target.name}]:`, target.value);
                    persist.setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
                }
            }
        }
        props.onInput?.(e);
    };

    const handleChange = (e: ChangeEvent<HTMLFormElement>) => {
        if (isRestoring.current) return;
        const target = e.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.name) {
                clearFieldError(target.name);
                if (target instanceof HTMLInputElement && target.type === "checkbox") {
                    log(`[${props.id ?? "anonymous"}] checkbox changed [${target.name}]:`, target.checked);
                    persist.setValue(target.name, target.checked ? "true" : "false");
                    runFieldValidation(target.name, target.checked ? "true" : "false");
                } else if (target instanceof HTMLInputElement && target.type === "radio") {
                    if (target.checked) {
                        log(`[${props.id ?? "anonymous"}] radio changed [${target.name}]:`, target.value);
                        persist.setValue(target.name, target.value);
                        runFieldValidation(target.name, target.value);
                    }
                } else if (target instanceof HTMLSelectElement) {
                    log(`[${props.id ?? "anonymous"}] select changed [${target.name}]:`, target.value);
                    persist.setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
                } else if (target instanceof HTMLInputElement && target.type === "file") {
                    const filesList = target.files ? Array.from(target.files) : [];
                    log(`[${props.id ?? "anonymous"}] file selected [${target.name}]:`, filesList);
                    savedFiles.current[target.name] = filesList;
                }
            }
        }
        props.onChange?.(e);
    };

    return (
        <FormyContext.Provider
            value={{
                state: resolvedState,
                isPending: resolvedIsPending,
                registerValidator,
            }}
        >
            <Form
                ref={formRef}
                action={resolvedFormAction}
                className={className}
                {...props}
                onSubmit={handleSubmit}
                onInput={handleInput}
                onChange={handleChange}
            >
                {typeof children === "function" ? children(state, resolvedIsPending) : children}
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
