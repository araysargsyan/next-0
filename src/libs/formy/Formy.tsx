"use client";

import {useContext, useEffect, useRef, useMemo} from "react";
import type {SubmitEvent} from "react";
import Form from "next/form";
import dynamic from "next/dynamic";
import type {FormyProps, OnActionChangeFn} from "./types";
import {FormyContext} from "./contexts/FormyContext";
import {FormyPersistContext} from "./contexts/FormyPersistContext";
import {useFormyActionState} from "./hooks/useFormyActionState";
import {useFormyErrorStore} from "./hooks/useFormyErrorStore";
import {ErrosContext} from "./contexts/ErrorsContext";
import {runFormValidation} from "./utils/validation";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import {createLogger} from "@/libs/utils/logger";

const FormyCoreDynamic = dynamic(() =>
    import("./FormyCore").then(m => ({ default: m.FormyCore }))
);

const log = createLogger("Formy", "magenta");
export default function Formy({
    action,
    initialState = null,
    children,
    onStateChange,
    className = "flex flex-col gap-4 w-full max-w-sm",
    clearOnSuccess = true,
    plainMode = false,
    onLoad: _onLoad,
    ...props
}: FormyProps) {
    useIsomorphicLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 Formy render`);
    });

    const formRef = useRef<HTMLFormElement>(null);
    const onActionChangeRef = useRef<OnActionChangeFn | null>(null);

    const [state, resolvedAction, isPending] = useFormyActionState(action, initialState);

    const { errorsStore, clearFieldError } = useFormyErrorStore(state, isPending);

    // Client-side validation registry
    const validatorsRef = useRef<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>({});

    const errorsContextValue = useMemo(
        () => ({
            store: errorsStore,
            clearFieldError,
            registerValidator: (
                name: string,
                validateFn: (value: string) => string | null,
                setErrorFn: (error: string | null) => void
            ) => {
                validatorsRef.current[name] = {validate: validateFn, setError: setErrorFn};
                return () => {
                    delete validatorsRef.current[name];
                };
            }
        }),
        [errorsStore, clearFieldError]
    );

    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");

    useEffect(() => {
        if (onStateChange) {
            onStateChange(state);
        }
    }, [state, onStateChange]);

    // Delegate action state changes to FormyCore's registered handler
    useEffect(() => {
        onActionChangeRef.current?.(state, isPending, clearOnSuccess);
    }, [state, isPending, clearOnSuccess]);

    const handleLightSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            const hasErrors = runFormValidation(validatorsRef.current, (name) => {
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

    const isRenderProp = typeof children === "function";
    const shouldBypassCore = isRenderProp || plainMode;

    return (
        <FormyContext.Provider value={{state, isPending}}>
            <ErrosContext.Provider value={errorsContextValue}>
                {shouldBypassCore ? (
                    resolvedAction ? (
                        <Form
                            ref={formRef}
                            action={resolvedAction}
                            className={className}
                            {...props}
                            onSubmit={handleLightSubmit}
                        >
                            {typeof children === "function" ? children(state, isPending) : children}
                        </Form>
                    ) : (
                        <form
                            ref={formRef}
                            className={className}
                            {...props}
                            onSubmit={handleLightSubmit}
                        >
                            {typeof children === "function" ? children(state, isPending) : children}
                        </form>
                    )
                ) : (
                    <FormyCoreDynamic
                        className={className}
                        clearFieldError={clearFieldError}
                        action={resolvedAction}
                        formRef={formRef}
                        validatorsRef={validatorsRef}
                        setValue={persist.setValue}
                        persist={persist}
                        onActionChangeRef={onActionChangeRef}
                        {...props}
                    >
                        {children}
                    </FormyCoreDynamic>
                )}
            </ErrosContext.Provider>
        </FormyContext.Provider>
    )
}

