"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { ErrorsStore } from "../utils/createErrorsStore";

export interface ErrorsContextValue {
    store: ErrorsStore;
    clearFieldError?: (name: string) => void;
    registerValidator?: (
        name: string,
        validateFn: (value: string) => string | null,
        setErrorFn: (error: string | null) => void
    ) => () => void;
}

export const ErrosContext = createContext<ErrorsContextValue | null>(null);

export const useErrorsContext = (key: string) => {
    const ctx = useContext(ErrosContext);
    if (!ctx) {
        throw new Error("useErrorsContext must be used within a <Formy> component.");
    }

    // Key part: getSnapshot is scoped to a SPECIFIC key.
    // useSyncExternalStore will compare the new value with the old one
    // and skip re-renders if THIS specific key didn't change —
    // even if the store notified all subscribers at once.
    const error = useSyncExternalStore(
        ctx.store.subscribe,
        () => ctx.store.getSnapshot()?.[key] || null,
        () => ctx.store.getSnapshot()?.[key] || null,
    );

    return { error, registerValidator: ctx.registerValidator, clearFieldError: ctx.clearFieldError };
};
