"use client";

import {
    useContext,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    useState
} from "react";
import type {
    SubmitEvent,
    InputEvent,
    ChangeEvent,ReactNode,
    Dispatch,
    SetStateAction,
    ComponentProps
} from "react";
import {useRouter} from "next/navigation";
import Form from "next/form";
import type {FormyActionState, StrictFormyState, FormyProps} from "./types";
import {FormyContext} from "./contexts/FormyContext";
import {FormyPersistContext} from "./contexts/FormyPersistContext";
import {useFormyActionState} from "./hooks/useFormyActionState";
import {setNativeValue, setNativeChecked} from "./utils/domHelpers";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import {createLogger} from "@/lib/logger";
import {ErrosContext} from "@/components/UI/Formy/contexts/ErrorsContext";
import {createErrorsStore} from "@/components/UI/Formy/utils/createErrorsStore";

const log = createLogger("Formy", "cyan");
interface AaProps<State extends FormyActionState & StrictFormyState<State>> extends Omit<
    FormyProps<State>,
    'children' | 'action' | 'initialState' | 'onStateChange' | 'submitLabel' | 'loadingLabel' | 'clearOnSuccess'
> {
    children: ReactNode;
    setState: Dispatch<SetStateAction<State | null>> | null;
    formAction: ComponentProps<typeof Form>['action'] | null;
    formRef: any;
    savedFiles: any;
    savedValues: any;
    isRestoring: any;
    setValue: any;
    validators: any;
}
const Aa = <State extends FormyActionState & StrictFormyState<State> = FormyActionState>({
                                                                                                  children,
                                                                                                  className = "flex flex-col gap-4 w-full max-w-sm",
                                                                                                  setState,
                                                                                                  formAction,
                                                                                                  formRef,
                                                                                                  savedFiles,
                                                                                                  savedValues,
                                                                                                  isRestoring,
                                                                                                  setValue,
                                                                                                  validators,
                                                                                                  ...props
                                                                                              }: AaProps<State>) => {
    useIsomorphicLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 render`);
    }, [])

    const clearFieldError = useCallback((name: string) => {
        setState((prev) => {
            if (!prev || !("error" in prev) || !prev.error) return prev;
            if (typeof prev.error === "string") {
                return {...prev, error: null};
            }
            if (typeof prev.error === "object") {
                const newError = {...prev.error};
                delete newError[name];
                return {
                    ...prev,
                    error: Object.keys(newError).length > 0 ? newError : null
                } as typeof prev;
            }
            return prev;
        });
    }, [setState]);


    const runFieldValidation = useCallback((name: string, value: string) => {
        const entry = validators.current[name];
        if (entry) {
            const error = entry.validate(value);
            log(`[${props.id ?? "anonymous"}] validate [${name}]:`, error ? `FAILED (${error})` : "PASSED");
            entry.setError(error);
        }
    }, [props.id]);


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

            log(`[${props.id ?? "anonymous"}] submitting form`, values);

            // Run client-side validation on submission
            let hasErrors = false;
            Object.entries(validators.current).forEach(([name, entry]) => {
                const error = entry.validate(savedValues.current[name] ?? "");
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
        if (isRestoring.current) return;
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
        if (isRestoring.current) return;
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
                    savedFiles.current[target.name] = filesList;
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
    const formRef = useRef<HTMLFormElement>(null);
    const router = useRouter();
    const [state, formAction, isPending, setState] = useFormyActionState<State>(action, initialState);

    const formyContextValue = useMemo(() => ({
        state: state ?? null,
        isPending: !!isPending
    }), [state, isPending]);
    const errors = useMemo(() => {
        const stateError = state && "error" in state ? state.error : null;

        return formyContextValue.isPending
                ? null : typeof stateError === 'string'
                    ? {'__global__': stateError}
                    : stateError || null
    },[formyContextValue.isPending, state])

    const [errorsStore] = useState(() => createErrorsStore(errors));
    useEffect(() => {
        if (errorsStore.getSnapshot() !== errors) {
            errorsStore.setErrors(errors);
        }
    }); // без deps-массива — сработает после КАЖДОГО рендера, но проверка по ссылке внутри дешёвая

    const errorsContextValue = useMemo(
        () => ({ store: errorsStore, registerValidator: (
                name: string,
                validateFn: (value: string) => string | null,
                setErrorFn: (error: string | null) => void
            ) => {
                validators.current[name] = {validate: validateFn, setError: setErrorFn};
                return () => {
                    delete validators.current[name];
                };
            } }),
        [errorsStore] // обе ссылки стабильны — value стабилен ВСЕГДА
    );

    const prevIsPending = useRef(formyContextValue.isPending);
    const savedValues = useRef<Record<string, string>>({});
    const savedFiles = useRef<Record<string, File[]>>({});
    const isRestoring = useRef(false);
    const hasHydrated = useRef(false);

    // Retrieve the persist hook from context (real implementation or no-op stub)
    // and call it unconditionally, as required by the Rules of Hooks.
    const usePersist = useContext(FormyPersistContext);
    const persist = usePersist(props.id ?? "");
    const persistRef = useRef(persist);

    // Client-side validation registry
    const validators = useRef<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>({});

    const restoreFromValues = useCallback((formEl: HTMLFormElement, values: Record<string, string>) => {
        if (Object.keys(values).length === 0) return;
        log(`[${props.id ?? "anonymous"}] restoring DOM values`, values);
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
                    fileInput.dispatchEvent(new Event("change", {bubbles: true}));
                } catch (err) {
                    console.error("Formy: failed to restore file input", err);
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
            isRestoring.current = true;
            restoreFromValues(formRef.current, values);
            isRestoring.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore field values after the action completes (RSC / Server Action reset)
    useEffect(() => {
        if (formyContextValue.state && "success" in formyContextValue.state && formyContextValue.state.success) {
            if (clearOnSuccess) {
                log(`[${props.id ?? "anonymous"}] action succeeded, clearing state`);
                persistRef.current.clear();
                savedValues.current = {};
                savedFiles.current = {};
            } else if (formRef.current) {
                log(`[${props.id ?? "anonymous"}] action succeeded, restoring final values`);
                isRestoring.current = true;
                restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValues.current);
                isRestoring.current = false;
            }
            prevIsPending.current = formyContextValue.isPending;
            return;
        }

        const didTransitionEnd = prevIsPending.current && !formyContextValue.isPending;
        prevIsPending.current = formyContextValue.isPending;

        if (didTransitionEnd && formRef.current) {
            log(
                `[${props.id ?? "anonymous"}] transition ended, restoring values`,
                persistRef.current.getValues() ?? savedValues.current
            );
            isRestoring.current = true;
            restoreFromValues(formRef.current, persistRef.current.getValues() ?? savedValues.current);
            isRestoring.current = false;
        }
    }, [clearOnSuccess, formyContextValue.isPending, formyContextValue.state, props.id, restoreFromValues]);

    useEffect(() => {
        if (onStateChange && state !== null) {
            onStateChange(state, router);
        }
    }, [state, onStateChange, router]);

    return <ErrosContext.Provider value={errorsContextValue}>
        <FormyContext.Provider value={formyContextValue}>
            <Aa
                className={className}
                setState={setState}
                formAction={formAction}
                formRef={formRef}
                savedFiles={savedFiles}
                savedValues={savedValues}
                isRestoring={isRestoring}
                setValue={persist.setValue}
                validators={validators}
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
            </Aa>
        </FormyContext.Provider>
    </ErrosContext.Provider>
}

