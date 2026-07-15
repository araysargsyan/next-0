"use client";

import {useEffect, useRef, useMemo, useLayoutEffect} from "react";
import Form from "next/form";
import {FormyContext, ErrorsContext, FormyModeContext} from "./contexts";
import {useFormyActionState, useFormyErrorStore} from "./hooks";
import {runFormValidation} from "./utils/validation";
import {FormyProps, Validators} from "./types";
import type {SubmitEvent} from "react";
import {createLogger} from "@/libs/utils/logger";
import {renderChildren} from "@/libs/formy/utils/renderChildren";

const log = createLogger("Formy", "magenta");
export default function Formy({
    action,
    initialState = null,
    children,
    onStateChange,
    className = "",
    clearOnSuccess = true,
    staticMode = true,
    ...props
}: FormyProps) {
    useLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 Formy render`);
    });

    const formRef = useRef<HTMLFormElement>(null);
    const fieldsetRef = useRef<HTMLFieldSetElement>(null);
    const validators = useRef<Validators>({});

    const [state, resolvedAction, isPending] = useFormyActionState(action, initialState);
    const { errorsStore, clearFieldError } = useFormyErrorStore(state, isPending);

    useEffect(() => {
        log(`[${props.id ?? "anonymous"}] Formy loaded, enabling fieldset`);
        if (fieldsetRef.current) {
            fieldsetRef.current.disabled = false;
        }
    }, [props.id]);

    const errorsContextValue = useMemo(
        () => ({
            store: errorsStore,
            clearFieldError,
            registerValidator: (
                name: string,
                validateFn: (value: string) => string | null,
                setErrorFn: (error: string | null) => void
            ) => {
                validators.current[name] = {validate: validateFn, setError: setErrorFn};
                return () => {
                    delete validators.current[name];
                };
            },
            runFieldValidation: (name: string, value: string) => {
                const entry = validators.current[name];
                if (entry) {
                    const error = entry.validate(value);
                    entry.setError(error);
                }
            }
        }),
        [errorsStore, clearFieldError]
    );

    useEffect(() => {
        if (onStateChange) {
            onStateChange(state);
        }
    }, [state, onStateChange]);

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            const hasErrors = runFormValidation(validators.current, (name) => {
                const val = formData.get(name);
                return typeof val === "string" ? val : "";
            });

            if (hasErrors) {
                log(`[${props.id ?? "anonymous"}] client validation failed (lightweight mode)`);
                e.preventDefault();
                return;
            }
        }
        props.onSubmit?.(e);
    };


    return (
        <FormyContext.Provider value={{state, isPending}}>
            <FormyModeContext.Provider value={{staticMode, clearOnSuccess}}>
                <ErrorsContext.Provider value={errorsContextValue}>
                    <fieldset ref={fieldsetRef} disabled style={{display: "contents"}}>
                        {
                            resolvedAction ? (
                                <Form
                                    ref={formRef}
                                    action={resolvedAction}
                                    className={className}
                                    {...props}
                                    onSubmit={handleSubmit}
                                >
                                    {renderChildren(children, state, isPending)}
                                </Form>
                            ) : (
                                <form
                                    ref={formRef}
                                    className={className}
                                    {...props}
                                    onSubmit={handleSubmit}
                                >
                                    {renderChildren(children, state, isPending)}
                                </form>
                            )
                        }
                    </fieldset>
                </ErrorsContext.Provider>
            </FormyModeContext.Provider>
        </FormyContext.Provider>
    )
}

