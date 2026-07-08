import {memo, useEffect, useRef, useCallback} from "react";
import type { SubmitEvent, InputEvent, ChangeEvent } from "react";
import Form from "next/form";
import type { FormyActionState, StrictFormyState, FormyCoreProps } from "./types";
import { createLogger } from "@/libs/utils/logger";
import { setNativeValue, setNativeChecked } from "./utils/domHelpers";

const log = createLogger("FormyCore", "cyan");

const FormyCoreInner = <State extends FormyActionState & StrictFormyState<State> = FormyActionState>({
    children,
    className = "flex flex-col gap-4 w-full max-w-sm",
    clearFieldError,
    formAction,
    formRef,
    setValue,
    validatorsRef,
    persist,
    state,
    isPending,
    clearOnSuccess,
    id,
    onLoad,
    ...props
}: FormyCoreProps<State> & { id?: string }) => {
    const prevIsPending = useRef(isPending);
    const savedValuesRef = useRef<Record<string, string>>({});
    const savedFilesRef = useRef<Record<string, File[]>>({});
    const isRestoringRef = useRef(false);
    const hasHydrated = useRef(false);
    const persistRef = useRef(persist);

    useEffect(() => {
        onLoad?.();
    }, [onLoad]);

    useEffect(() => {
        persistRef.current = persist;
    });


    const restoreFromValues = useCallback((formEl: HTMLFormElement, values: Record<string, string>) => {
        if (Object.keys(values).length === 0) return;
        log(`[${id ?? "anonymous"}] restoring DOM values`, values);
        formEl.querySelectorAll("input, textarea, select").forEach((el) => {
            if (el instanceof HTMLInputElement) {
                if (!el.name || values[el.name] === undefined) return;
                if (el.type === "checkbox") {
                    setNativeChecked(el, values[el.name] === "true");
                } else if (el.type === "radio") {
                    setNativeChecked(el, el.value === values[el.name]);
                } else if (el.type !== "file") {
                    setNativeValue(el, values[el.name]);
                }
            } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
                if (!el.name || values[el.name] === undefined) return;
                setNativeValue(el, values[el.name]);
            }
        });

        // Restore file inputs from the local ref using DataTransfer
        formEl.querySelectorAll('input[type="file"]').forEach((el) => {
            if (el instanceof HTMLInputElement) {
                const files = savedFilesRef.current[el.name];
                if (files && files.length > 0) {
                    try {
                        const dt = new DataTransfer();
                        files.forEach((file) => dt.items.add(file));
                        el.files = dt.files;
                        el.dispatchEvent(new Event("change", {bubbles: true}));
                    } catch (err) {
                        console.error("Formy: failed to restore file input", err);
                    }
                }
            }
        });
    }, [id]);

    // Hydrate field values from the persist adapter on mount
    useEffect(() => {
        if (hasHydrated.current) return;
        hasHydrated.current = true;

        const values = persistRef.current.getValues();
        if (values && formRef.current && Object.keys(values).length > 0) {
            log(`[${id ?? "anonymous"}] mount hydration: restoring from store`, values);
            isRestoringRef.current = true;
            restoreFromValues(formRef.current, values);
            isRestoringRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore field values after the action completes (RSC / Server Action reset)
    useEffect(() => {
        if (state && "data" in state) {
            if (clearOnSuccess) {
                log(`[${id ?? "anonymous"}] action succeeded, clearing state`);
                persistRef.current.clear();
                savedValuesRef.current = {};
                savedFilesRef.current = {};
            } else if (formRef.current) {
                log(`[${id ?? "anonymous"}] action succeeded, restoring final values`);
                isRestoringRef.current = true;
                restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValuesRef.current);
                isRestoringRef.current = false;
            }
            prevIsPending.current = isPending;
            return;
        }

        const didTransitionEnd = prevIsPending.current && !isPending;
        prevIsPending.current = isPending;

        if (didTransitionEnd && formRef.current) {
            log(
                `[${id ?? "anonymous"}] transition ended, restoring values`,
                persistRef.current.getValues() ?? savedValuesRef.current
            );
            isRestoringRef.current = true;
            restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValuesRef.current);
            isRestoringRef.current = false;
        }
    }, [clearOnSuccess, isPending, state, id, restoreFromValues, formRef]);

    const runFieldValidation = (name: string, value: string) => {
        const entry = validatorsRef.current[name];
        if (entry) {
            const error = entry.validate(value);
            log(`[${id ?? "anonymous"}] validate [${name}]:`, error ? `FAILED (${error})` : "PASSED");
            entry.setError(error);
        }
    }

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);

            // Explicitly capture unchecked checkboxes as "false"
            formRef.current.querySelectorAll('input[type="checkbox"]').forEach((el) => {
                if (el instanceof HTMLInputElement) {
                    if (el.name && !formData.has(el.name)) {
                        formData.append(el.name, "false");
                    }
                }
            });

            const values: Record<string, string> = {};
            formData.forEach((val, key) => {
                if (typeof val === "string") {
                    values[key] = val;
                }
            });
            savedValuesRef.current = values;

            log(`[${id ?? "anonymous"}] submitting form`, values);

            // Run client-side validation on submission
            let hasErrors = false;
            Object.entries(validatorsRef.current).forEach(([name, entry]) => {
                const error = entry.validate(savedValuesRef.current[name] ?? "");
                entry.setError(error);
                if (error) {
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                log(`[${id ?? "anonymous"}] client validation failed`);
                e.preventDefault();
                return;
            }
        }
        props.onSubmit?.(e);
    };

    const handleInput = (e: InputEvent<HTMLFormElement>) => {
        if (isRestoringRef.current) return;
        const target = e.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.name) {
                clearFieldError(target.name);
                if (target.type !== "file" && target.type !== "checkbox" && target.type !== "radio") {
                    log(`[${id ?? "anonymous"}] input [${target.name}]:`, target.value);
                    setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
                }
            }
        }
        props.onInput?.(e);
    };

    const handleChange = (e: ChangeEvent<HTMLFormElement>) => {
        if (isRestoringRef.current) return;
        const target = e.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.name) {
                clearFieldError(target.name);
                if (target instanceof HTMLInputElement && target.type === "checkbox") {
                    log(`[${id ?? "anonymous"}] checkbox changed [${target.name}]:`, target.checked);
                    setValue(target.name, target.checked ? "true" : "false");
                    runFieldValidation(target.name, target.checked ? "true" : "false");
                } else if (target instanceof HTMLInputElement && target.type === "radio") {
                    if (target.checked) {
                        log(`[${id ?? "anonymous"}] radio changed [${target.name}]:`, target.value);
                        setValue(target.name, target.value);
                        runFieldValidation(target.name, target.value);
                    }
                } else if (target instanceof HTMLSelectElement) {
                    log(`[${id ?? "anonymous"}] select changed [${target.name}]:`, target.value);
                    setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
                } else if (target instanceof HTMLInputElement && target.type === "file") {
                    const filesList = target.files ? Array.from(target.files) : [];
                    log(`[${id ?? "anonymous"}] file selected [${target.name}]:`, filesList);
                    savedFilesRef.current[target.name] = filesList;
                }
            }
        }
        props.onChange?.(e);
    };

    if (formAction) {
        return <Form
            ref={formRef}
            action={formAction}
            className={className}
            {...props}
            onSubmit={handleSubmit}
            onInput={handleInput}
            onChange={handleChange}
        >
            {children}
        </Form>
    }

    return <form
        ref={formRef}
        className={className}
        {...props}
        onSubmit={handleSubmit}
        onInput={handleInput}
        onChange={handleChange}
    >
        {children}
    </form>
}

export const FormyCore = memo<typeof FormyCoreInner>(FormyCoreInner);

