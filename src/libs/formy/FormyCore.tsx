import {memo, useEffect, useRef, useCallback} from "react";
import type { SubmitEvent, InputEvent, ChangeEvent } from "react";
import Form from "next/form";
import type { FormyCoreProps } from "./types";
import { createLogger } from "@/libs/utils/logger";
import { setNativeValue, setNativeChecked } from "./utils/domHelpers";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";

const log = createLogger("FormyCore", "cyan");
console.log("FormyCore=SERVER RENDERING")
const FormyCoreInner = ({
    children,
    className = "flex flex-col gap-4 w-full max-w-sm",
    clearFieldError,
    formAction,
    formRef,
    setValue,
    validatorsRef,
    persist,
    onActionChangeRef,
    id,
    ...props
}: FormyCoreProps & { id?: string }) => {
    useIsomorphicLayoutEffect(()=>{
        log(`[${id ?? "anonymous"}] 🔄 FormyCoreInner render`);
    })
    const fieldsetRef = useRef<HTMLFieldSetElement>(null);
    const localState = useRef({
        /**
         * Snapshot of all form field values (name → value) captured
         * at submit time in `handleSubmit`. Fallback source for DOM
         * restoration when the persist store is not connected
         * (i.e. `persist.getValues()` returns `undefined`).
         */
        savedValues: {} as Record<string, string>,

        /**
         * Snapshot of File objects per file-input name, captured in
         * `handleChange`. Browsers block programmatic `.value` setting
         * on file inputs — we restore them via DataTransfer API.
         */
        savedFiles: {} as Record<string, File[]>,

        /**
         * Guard flag, `true` while `restoreFromValues` is running.
         * Prevents infinite loop: `setNativeValue` dispatches synthetic
         * events → `handleInput`/`handleChange` would re-save values
         * being restored without this guard.
         */
        isRestoring: false,

        /**
         * `true` after initial mount hydration from the persist store.
         * Prevents double-hydration in React Strict Mode (dev),
         * where mount effects fire twice.
         */
        hasHydrated: false,

        /**
         * Always-fresh reference to the `persist` adapter prop.
         * Stored here so callbacks/effects read the latest adapter
         * without needing `persist` in dependency arrays.
         */
        persist: persist,
    });

    useEffect(() => {
        log(`[${id ?? "anonymous"}] FormyCore loaded, enabling fieldset`);
        if (fieldsetRef.current) {
            fieldsetRef.current.disabled = false;
        }
    }, [id]);

    useEffect(() => {
        localState.current.persist = persist;
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
                const files = localState.current.savedFiles[el.name];
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
        if (localState.current.hasHydrated) return;
        localState.current.hasHydrated = true;

        const values = localState.current.persist.getValues();
        if (values && formRef.current && Object.keys(values).length > 0) {
            log(`[${id ?? "anonymous"}] mount hydration: restoring from store`, values);
            localState.current.isRestoring = true;
            restoreFromValues(formRef.current, values);
            localState.current.isRestoring = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Register action change handler — Formy calls this from its useEffect
    useEffect(() => {
        let isActionEnded = false;

        onActionChangeRef.current = (state, isPending, clearOnSuccess) => {
            // Action is running — arm the flag for when it completes
            if (isPending) {
                isActionEnded = true;
                return;
            }

            // Consume the flag (read + reset)
            const actionEnded = isActionEnded;
            isActionEnded = false;

            if (state && "data" in state) {
                if (clearOnSuccess) {
                    log(`[${id ?? "anonymous"}] action succeeded, clearing state`);
                    localState.current.persist.clear();
                    localState.current.savedValues = {};
                    localState.current.savedFiles = {};
                } else if (formRef.current) {
                    log(`[${id ?? "anonymous"}] action succeeded, restoring final values`);
                    localState.current.isRestoring = true;
                    restoreFromValues(formRef.current, localState.current.persist.getValues() ?? localState.current.savedValues);
                    localState.current.isRestoring = false;
                }
                return;
            }

            if (actionEnded && formRef.current) {
                log(
                    `[${id ?? "anonymous"}] action ended, restoring values`,
                    localState.current.persist.getValues() ?? localState.current.savedValues
                );
                localState.current.isRestoring = true;
                restoreFromValues(formRef.current, localState.current.persist.getValues() ?? localState.current.savedValues);
                localState.current.isRestoring = false;
            }
        };

        return () => {
            onActionChangeRef.current = null;
        };
    }, [id, formRef, restoreFromValues, onActionChangeRef]);

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
            localState.current.savedValues = values;

            log(`[${id ?? "anonymous"}] submitting form`, values);

            // Run client-side validation on submission
            let hasErrors = false;
            Object.entries(validatorsRef.current).forEach(([name, entry]) => {
                const error = entry.validate(localState.current.savedValues[name] ?? "");
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
        if (localState.current.isRestoring) return;
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
        if (localState.current.isRestoring) return;
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
                    localState.current.savedFiles[target.name] = filesList;
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
            <fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
                {children}
            </fieldset>
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
        <fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
            {children}
        </fieldset>
    </form>
}

export const FormyCore = memo(FormyCoreInner);

