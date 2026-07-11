import {memo, useEffect, useRef, useCallback} from "react";
import type { SubmitEvent, InputEvent, ChangeEvent } from "react";
import Form from "next/form";
import type { FormyCoreProps } from "./types";
import { createLogger } from "@/libs/utils/logger";
import { setNativeValue, setNativeChecked } from "./utils/domHelpers";
import { runFormValidation } from "./utils/validation";
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
        /** Fallback value snapshot for DOM restoration when store is disconnected. */
        savedValues: {} as Record<string, string>,

        /** Guard to prevent event loop during DOM restoration. */
        isRestoring: false,

        /** Flag to prevent double-hydration in Strict Mode. */
        hasHydrated: false,

        /** Fresh reference to store persist adapter. */
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
            const hasErrors = runFormValidation(
                validatorsRef.current,
                (name) => localState.current.savedValues[name] ?? ""
            );

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
                if (target.type !== "file" && target.type !== "checkbox" && target.type !== "radio") {
                    clearFieldError(target.name);
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
                if (target instanceof HTMLInputElement && target.type === "checkbox") {
                    clearFieldError(target.name);
                    log(`[${id ?? "anonymous"}] checkbox changed [${target.name}]:`, target.checked);
                    setValue(target.name, target.checked ? "true" : "false");
                    runFieldValidation(target.name, target.checked ? "true" : "false");
                } else if (target instanceof HTMLInputElement && target.type === "radio") {
                    if (target.checked) {
                        clearFieldError(target.name);
                        log(`[${id ?? "anonymous"}] radio changed [${target.name}]:`, target.value);
                        setValue(target.name, target.value);
                        runFieldValidation(target.name, target.value);
                    }
                } else if (target instanceof HTMLSelectElement) {
                    clearFieldError(target.name);
                    log(`[${id ?? "anonymous"}] select changed [${target.name}]:`, target.value);
                    setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
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

