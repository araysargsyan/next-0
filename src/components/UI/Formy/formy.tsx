"use client";

import { useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { SubmitEvent, InputEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Form from "next/form";
import type { FormyActionState, StrictFormyState, FormyProps } from "./types";
import { FormyContext } from "./contexts/FormyContext";
import { FormyPersistContext } from "./contexts/FormyPersistContext";
import { useFormyActionState } from "./hooks/useFormyActionState";
import { setNativeValue, setNativeChecked } from "./utils/domHelpers";

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

    const resolvedFormAction = formAction || "";
    const resolvedIsPending = !!isPending;


    const formRef = useRef<HTMLFormElement>(null);
    const savedValues = useRef<Record<string, string>>({});
    const savedFiles = useRef<Record<string, File[]>>({});
    const isRestoring = useRef(false);
    const prevIsPending = useRef(resolvedIsPending);
    const hasHydrated = useRef(false);

    // Client-side validation registry and errors state
    const validators = useRef<Record<string, (value: string) => string | null>>({});
    const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

    // Track which fields have been edited by the user since the last submission
    const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});

    const markFieldAsEdited = useCallback((name: string) => {
        setEditedFields((prev) => {
            if (prev[name]) return prev;
            return { ...prev, [name]: true };
        });
    }, []);

    // Adjust state during render when state.success becomes true
    const [prevSuccess, setPrevSuccess] = useState(false);
    const currentSuccess = !!(state && "success" in state && state.success);
    if (currentSuccess !== prevSuccess) {
        setPrevSuccess(currentSuccess);
        if (currentSuccess && clearOnSuccess) {
            setClientErrors({});
            setEditedFields({});
        }
    }

    // Reset editedFields when a new submission starts (resolvedIsPending transitions false -> true)
    const [prevIsPendingState, setPrevIsPendingState] = useState(false);
    if (resolvedIsPending !== prevIsPendingState) {
        setPrevIsPendingState(resolvedIsPending);
        if (resolvedIsPending) {
            setEditedFields({});
        }
    }

    console.log(
        `%c[Formy: ${props.id ?? "anonymous"}] 🔄 render`,
        "color: #00bfff; font-weight: bold;",
        { state, resolvedIsPending, clientErrors, editedFields }
    );

    const registerValidator = useCallback((name: string, validateFn: (value: string) => string | null) => {
        validators.current[name] = validateFn;
        return () => {
            delete validators.current[name];
            setClientErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        };
    }, [setClientErrors]);

    // Merge server and client errors, filtering out server errors for edited fields
    const hasClientErrors = Object.keys(clientErrors).length > 0;
    const stateError = state && "error" in state ? state.error : undefined;
    const resolvedState: FormyActionState | null = useMemo(() => {
        if (!state && !hasClientErrors) return null;

        let activeServerError = stateError;
        if (typeof stateError === "object" && stateError !== null) {
            const filtered: Record<string, string> = {};
            Object.entries(stateError).forEach(([key, val]) => {
                if (!editedFields[key]) {
                    filtered[key] = val;
                }
            });
            activeServerError = filtered;
        } else if (typeof stateError === "string" && Object.keys(editedFields).length > 0) {
            activeServerError = undefined;
        }

        return {
            success: state ? state.success : false,
            error: typeof activeServerError === "string"
                ? activeServerError
                : {
                    ...(typeof activeServerError === "object" && activeServerError !== null ? activeServerError : null),
                    ...clientErrors
                  }
        };
    }, [state, hasClientErrors, stateError, clientErrors, editedFields]);

    // Retrieve the persist hook from context (real implementation or no-op stub)
    // and call it unconditionally, as required by the Rules of Hooks.
    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");
    const persistRef = useRef(persist);

    const runFieldValidation = useCallback((name: string, value: string) => {
        const validateFn = validators.current[name];
        if (validateFn) {
            const error = validateFn(value);
            console.log(
                `%c[Formy: ${props.id ?? "anonymous"}] validate [${name}]:`,
                "color: #da70d6; font-weight: bold;",
                error ? `FAILED (${error})` : "PASSED"
            );
            setClientErrors((prev) => {
                const next = { ...prev };
                if (error) {
                    next[name] = error;
                } else {
                    delete next[name];
                }
                return next;
            });
        }
    }, [setClientErrors, props.id]);

    const restoreFromValues = useCallback((formEl: HTMLFormElement, values: Record<string, string>) => {
        if (Object.keys(values).length === 0) return;
        console.log(
            `%c[Formy: ${props.id ?? "anonymous"}] restoring DOM values`,
            "color: #20b2aa; font-weight: bold;",
            values
        );
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

        const values = persist.values;
        if (values && formRef.current && Object.keys(values).length > 0) {
            console.log(
                `%c[Formy: ${props.id ?? "anonymous"}] mount hydration: restoring from store`,
                "color: #32cd32; font-weight: bold;",
                values
            );
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
                console.log(
                    `%c[Formy: ${props.id ?? "anonymous"}] action succeeded, clearing state`,
                    "color: #32cd32; font-weight: bold;"
                );
                persistRef.current.clear();
                savedValues.current = {};
                savedFiles.current = {};
            } else if (formRef.current) {
                console.log(
                    `%c[Formy: ${props.id ?? "anonymous"}] action succeeded, restoring final values`,
                    "color: #32cd32; font-weight: bold;"
                );
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
            console.log(
                `%c[Formy: ${props.id ?? "anonymous"}] transition ended, restoring values`,
                "color: #ffa500; font-weight: bold;",
                persistRef.current.values ?? savedValues.current
            );
            isRestoring.current = true;
            restoreFromValues(formRef.current, persistRef.current.values ?? savedValues.current);
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

            console.log(
                `%c[Formy: ${props.id ?? "anonymous"}] submitting form`,
                "color: #ff1493; font-weight: bold;",
                values
            );

            // Run client-side validation on submission
            const errors: Record<string, string> = {};
            Object.entries(validators.current).forEach(([name, validateFn]) => {
                const error = validateFn(values[name] ?? "");
                if (error) {
                    errors[name] = error;
                }
            });

            if (Object.keys(errors).length > 0) {
                console.log(
                    `%c[Formy: ${props.id ?? "anonymous"}] client validation failed`,
                    "color: #d8000c; font-weight: bold;",
                    errors
                );
                e.preventDefault();
                setClientErrors(errors);
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
                markFieldAsEdited(target.name);
                if (target.type !== "file" && target.type !== "checkbox" && target.type !== "radio") {
                    console.log(
                        `%c[Formy: ${props.id ?? "anonymous"}] input [${target.name}]:`,
                        "color: #ff8c00; font-weight: bold;",
                        target.value
                    );
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
                markFieldAsEdited(target.name);
                if (target instanceof HTMLInputElement && target.type === "checkbox") {
                    console.log(
                        `%c[Formy: ${props.id ?? "anonymous"}] checkbox changed [${target.name}]:`,
                        "color: #ff8c00; font-weight: bold;",
                        target.checked
                    );
                    persist.setValue(target.name, target.checked ? "true" : "false");
                    runFieldValidation(target.name, target.checked ? "true" : "false");
                } else if (target instanceof HTMLInputElement && target.type === "radio") {
                    if (target.checked) {
                        console.log(
                            `%c[Formy: ${props.id ?? "anonymous"}] radio changed [${target.name}]:`,
                            "color: #ff8c00; font-weight: bold;",
                            target.value
                        );
                        persist.setValue(target.name, target.value);
                        runFieldValidation(target.name, target.value);
                    }
                } else if (target instanceof HTMLSelectElement) {
                    console.log(
                        `%c[Formy: ${props.id ?? "anonymous"}] select changed [${target.name}]:`,
                        "color: #ff8c00; font-weight: bold;",
                        target.value
                    );
                    persist.setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
                } else if (target instanceof HTMLInputElement && target.type === "file") {
                    if (target.files) {
                        console.log(
                            `%c[Formy: ${props.id ?? "anonymous"}] file selected [${target.name}]:`,
                            "color: #ff8c00; font-weight: bold;",
                            Array.from(target.files)
                        );
                        savedFiles.current[target.name] = Array.from(target.files);
                    }
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
