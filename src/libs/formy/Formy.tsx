"use client";

import {useContext, useEffect, useRef, useMemo} from "react";
import type {SubmitEvent} from "react";
import {useRouter} from "next/navigation";
import Form from "next/form";
import dynamic from "next/dynamic";
import type {FormyActionState, StrictFormyState, FormyProps, OnActionChangeFn} from "./types";
import {FormyContext} from "./contexts/FormyContext";
import {FormyPersistContext} from "./contexts/FormyPersistContext";
import {useFormyActionState} from "./hooks/useFormyActionState";
import {useFormyErrors} from "./hooks/useFormyErrors";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import {createLogger} from "@/libs/utils/logger";
import {ErrosContext} from "./contexts/ErrorsContext";
import until from "@/libs/utils/until";

const log = createLogger("Formy", "magenta");
console.log("Formy=SERVER RENDERING")
const FormyCoreDynamic = dynamic(() =>
    until(1000, ()=>console.log('start dynamic import')).then(() => import("./FormyCore").then(m => ({ default: m.FormyCore })))
);

export default function Formy<State extends FormyActionState & StrictFormyState<State> = FormyActionState>({
    action,
    initialState = null,
    children,
    onStateChange,
    className = "flex flex-col gap-4 w-full max-w-sm",
    clearOnSuccess = true,
    plainMode = false,
    onLoad: _onLoad,
    ...props
}: FormyProps<State>) {
    useIsomorphicLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 Formy render`);
    });

    const formRef = useRef<HTMLFormElement>(null);
    const onActionChangeRef = useRef<OnActionChangeFn | null>(null);

    const router = useRouter();
    const [state, formAction, isPending] = useFormyActionState<State>(action, initialState);

    const formyContextValue = useMemo(() => ({
        state: state ?? null,
        isPending: !!isPending
    }), [state, isPending]);
    const { errorsStore, clearFieldError } = useFormyErrors(state ?? null, formyContextValue.isPending);

    // Client-side validation registry
    const validatorsRef = useRef<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>({});

    const errorsContextValue = useMemo(
        () => ({ store: errorsStore, registerValidator: (
                name: string,
                validateFn: (value: string) => string | null,
                setErrorFn: (error: string | null) => void
            ) => {
                validatorsRef.current[name] = {validate: validateFn, setError: setErrorFn};
                return () => {
                    delete validatorsRef.current[name];
                };
            } }),
        [errorsStore]
    );

    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    // Delegate action state changes to FormyCore's registered handler
    useEffect(() => {
        onActionChangeRef.current?.(formyContextValue.state, formyContextValue.isPending, clearOnSuccess);
    }, [formyContextValue.state, formyContextValue.isPending, clearOnSuccess]);

    const handleLightSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            let hasErrors = false;
            Object.entries(validatorsRef.current).forEach(([name, entry]) => {
                const val = formData.get(name);
                const error = entry.validate(typeof val === "string" ? val : "");
                entry.setError(error);
                if (error) {
                    hasErrors = true;
                }
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

    return <ErrosContext.Provider value={errorsContextValue}>
        <FormyContext.Provider value={formyContextValue}>
            {shouldBypassCore ? (
                formAction ? (
                    <Form
                        ref={formRef}
                        action={formAction}
                        className={className}
                        {...props}
                        onSubmit={handleLightSubmit}
                    >
                        {typeof children === "function" ? children(state, formyContextValue.isPending) : children}
                    </Form>
                ) : (
                    <form
                        ref={formRef}
                        className={className}
                        {...props}
                        onSubmit={handleLightSubmit}
                    >
                        {typeof children === "function" ? children(state, formyContextValue.isPending) : children}
                    </form>
                )
            ) : (
                <FormyCoreDynamic
                    className={className}
                    clearFieldError={clearFieldError}
                    formAction={formAction}
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
        </FormyContext.Provider>
    </ErrosContext.Provider>
}

