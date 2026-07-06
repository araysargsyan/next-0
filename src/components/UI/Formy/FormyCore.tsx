"use client";

import { useCallback } from "react";
import type { SubmitEvent, InputEvent, ChangeEvent } from "react";
import Form from "next/form";
import type { FormyActionState, StrictFormyState, FormyCoreProps } from "./types";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import { createLogger } from "@/lib/logger";

const log = createLogger("FormyCore", "cyan");

export const FormyCore = <State extends FormyActionState & StrictFormyState<State> = FormyActionState>({
    children,
    className = "flex flex-col gap-4 w-full max-w-sm",
    clearFieldError,
    formAction,
    formRef,
    savedFilesRef,
    savedValuesRef,
    isRestoringRef,
    setValue,
    validatorsRef,
    ...props
}: FormyCoreProps<State>) => {
    useIsomorphicLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 FormyCore render`);
    });

    const runFieldValidation = useCallback((name: string, value: string) => {
        const entry = validatorsRef.current[name];
        if (entry) {
            const error = entry.validate(value);
            log(`[${props.id ?? "anonymous"}] validate [${name}]:`, error ? `FAILED (${error})` : "PASSED");
            entry.setError(error);
        }
    }, [props.id, validatorsRef]);

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

            log(`[${props.id ?? "anonymous"}] submitting form`, values);

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
                log(`[${props.id ?? "anonymous"}] client validation failed`);
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
                    log(`[${props.id ?? "anonymous"}] input [${target.name}]:`, target.value);
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
                    log(`[${props.id ?? "anonymous"}] checkbox changed [${target.name}]:`, target.checked);
                    setValue(target.name, target.checked ? "true" : "false");
                    runFieldValidation(target.name, target.checked ? "true" : "false");
                } else if (target instanceof HTMLInputElement && target.type === "radio") {
                    if (target.checked) {
                        log(`[${props.id ?? "anonymous"}] radio changed [${target.name}]:`, target.value);
                        setValue(target.name, target.value);
                        runFieldValidation(target.name, target.value);
                    }
                } else if (target instanceof HTMLSelectElement) {
                    log(`[${props.id ?? "anonymous"}] select changed [${target.name}]:`, target.value);
                    setValue(target.name, target.value);
                    runFieldValidation(target.name, target.value);
                } else if (target instanceof HTMLInputElement && target.type === "file") {
                    const filesList = target.files ? Array.from(target.files) : [];
                    log(`[${props.id ?? "anonymous"}] file selected [${target.name}]:`, filesList);
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
