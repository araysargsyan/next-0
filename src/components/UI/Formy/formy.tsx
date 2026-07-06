"use client";

import {useContext, useEffect, useRef, useCallback, useMemo} from "react";
import {useRouter} from "next/navigation";
import type {FormyActionState, StrictFormyState, FormyProps} from "./types";
import {FormyContext} from "./contexts/FormyContext";
import {FormyPersistContext} from "./contexts/FormyPersistContext";
import {useFormyActionState} from "./hooks/useFormyActionState";
import {useFormyErrors} from "./hooks/useFormyErrors";
import {setNativeValue, setNativeChecked} from "./utils/domHelpers";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import {createLogger} from "@/lib/logger";
import {ErrosContext} from "@/components/UI/Formy/contexts/ErrorsContext";
import {FormyCore} from "./FormyCore";

const log = createLogger("Formy", "magenta");

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
    useIsomorphicLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 Formy render`);
    });

    const formRef = useRef<HTMLFormElement>(null);
    const router = useRouter();
    const [state, formAction, isPending] = useFormyActionState<State>(action, initialState);

    const formyContextValue = useMemo(() => ({
        state: state ?? null,
        isPending: !!isPending
    }), [state, isPending]);
    const { errorsStore, clearFieldError } = useFormyErrors(state ?? null, formyContextValue.isPending);

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
        [errorsStore] // обе ссылки стабильны — value стабилен ВСЕГДА
    );

    const prevIsPending = useRef(formyContextValue.isPending);
    const savedValuesRef = useRef<Record<string, string>>({});
    const savedFilesRef = useRef<Record<string, File[]>>({});
    const isRestoringRef = useRef(false);
    const hasHydrated = useRef(false);

    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");
    const persistRef = useRef(persist);

    // Client-side validation registry
    const validatorsRef = useRef<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>({});

    const restoreFromValues = useCallback((formEl: HTMLFormElement, values: Record<string, string>) => {
        if (Object.keys(values).length === 0) return;
        log(`[${props.id ?? "anonymous"}] restoring DOM values`, values);
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
    }, [props.id]);

    useEffect(() => {
        persistRef.current = persist;
    });

    // Hydrate field values from the persist adapter on mount (runs once)
    useEffect(() => {
        if (hasHydrated.current) return;
        hasHydrated.current = true;

        const values = persist.getValues();
        if (values && formRef.current && Object.keys(values).length > 0) {
            log(`[${props.id ?? "anonymous"}] mount hydration: restoring from store`, values);
            isRestoringRef.current = true;
            restoreFromValues(formRef.current, values);
            isRestoringRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore field values after the action completes (RSC / Server Action reset)
    useEffect(() => {
        if (formyContextValue.state && "success" in formyContextValue.state && formyContextValue.state.success) {
            if (clearOnSuccess) {
                log(`[${props.id ?? "anonymous"}] action succeeded, clearing state`);
                persistRef.current.clear();
                savedValuesRef.current = {};
                savedFilesRef.current = {};
            } else if (formRef.current) {
                log(`[${props.id ?? "anonymous"}] action succeeded, restoring final values`);
                isRestoringRef.current = true;
                restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValuesRef.current);
                isRestoringRef.current = false;
            }
            prevIsPending.current = formyContextValue.isPending;
            return;
        }

        const didTransitionEnd = prevIsPending.current && !formyContextValue.isPending;
        prevIsPending.current = formyContextValue.isPending;

        if (didTransitionEnd && formRef.current) {
            log(
                `[${props.id ?? "anonymous"}] transition ended, restoring values`,
                persistRef.current.getValues() ?? savedValuesRef.current
            );
            isRestoringRef.current = true;
            restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValuesRef.current);
            isRestoringRef.current = false;
        }
    }, [clearOnSuccess, formyContextValue.isPending, formyContextValue.state, props.id, restoreFromValues]);

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    return <ErrosContext.Provider value={errorsContextValue}>
        <FormyContext.Provider value={formyContextValue}>
            <FormyCore
                className={className}
                clearFieldError={clearFieldError}
                formAction={formAction}
                formRef={formRef}
                savedFilesRef={savedFilesRef}
                savedValuesRef={savedValuesRef}
                isRestoringRef={isRestoringRef}
                setValue={persist.setValue}
                validatorsRef={validatorsRef}
                {...props}
            >
                {typeof children === "function" ? children(state, formyContextValue.isPending) : children}
                {submitLabel && (
                    <button
                        type="submit"
                        disabled={formyContextValue.isPending}
                        className="bg-black text-white rounded-lg px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                        {formyContextValue.isPending ? loadingLabel : submitLabel}
                    </button>
                )}
            </FormyCore>
        </FormyContext.Provider>
    </ErrosContext.Provider>
}
