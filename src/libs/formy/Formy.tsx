"use client";

import {useEffect, useRef, useMemo, useLayoutEffect} from "react";
import { FormyContext, ErrorsContext, FormyModeContext } from "./contexts";
import { useFormyActionState, useFormyErrorStore } from "./hooks";
import type { FormyProps, Validators } from "./types";
import { createLogger } from "@/libs/utils/logger";
import { renderChildren } from "@/libs/formy/utils/renderChildren";
import { FormContent } from "./components/FormContent/FormContent";

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
        log(`[${props.id ?? "anonymous"}] 🔄 render`);
    });
    const validators = useRef<Validators>({});
    const [state, resolvedAction, isPending] = useFormyActionState(action, initialState);
    const { errorsStore, clearFieldError } = useFormyErrorStore(state, isPending);

    const errorsContextValue = useMemo(
        () => ({
            store: errorsStore,
            clearFieldError,
            registerValidator: (
                name: string,
                validateFn: (value: string) => string | null,
                setErrorFn: (error: string | null) => void
            ) => {
                validators.current[name] = { validate: validateFn, setError: setErrorFn };
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
            },
        }),
        [errorsStore, clearFieldError]
    );

    useEffect(() => {
        if (onStateChange) {
            onStateChange(state);
        }
    }, [state, onStateChange]);

    return (
        <FormyContext.Provider value={{ state, isPending }}>
            <FormyModeContext.Provider value={{ staticMode, clearOnSuccess }}>
                <ErrorsContext.Provider value={errorsContextValue}>
                    <FormContent
                        validators={validators}
                        action={resolvedAction}
                        className={className}
                        staticMode={staticMode}
                        {...props}
                    >
                        {renderChildren(children, state, isPending)}
                    </FormContent>
                </ErrorsContext.Provider>
            </FormyModeContext.Provider>
        </FormyContext.Provider>
    );
}
