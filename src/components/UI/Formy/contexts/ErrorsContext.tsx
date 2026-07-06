"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { ErrorsStore } from "../utils/createErrorsStore";

export interface ErrorsContextValue {
    store: ErrorsStore;
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

    // Ключевая часть: getSnapshot скоуплен на КОНКРЕТНЫЙ key.
    // useSyncExternalStore сам сравнит новое значение со старым и
    // пропустит ре-рендер, если именно ЭТОТ key не изменился —
    // даже если store оповестил всех подписчиков сразу.
    const error = useSyncExternalStore(
        ctx.store.subscribe,
        () => ctx.store.getSnapshot()?.[key] || null,
        () => ctx.store.getSnapshot()?.[key] || null,
    );

    return { error, registerValidator: ctx.registerValidator };
};
