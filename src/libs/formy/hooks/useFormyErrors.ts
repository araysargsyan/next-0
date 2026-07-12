"use client";

import {useContext, useSyncExternalStore} from "react";
import { ErrorsContext } from "../contexts";

export const useFormyErrors = (key?: string) => {
    const ctx = useContext(ErrorsContext);
    if (!ctx) {
        throw new Error("useErrorsContext must be used within a <Formy> component.");
    }

    const {store, registerValidator, clearFieldError, runFieldValidation} = ctx
    // Key part: getSnapshot is scoped to a SPECIFIC key.
    // useSyncExternalStore will compare the new value with the old one
    // and skip re-renders if THIS specific key didn't change —
    // even if the store notified all subscribers at once.
    const error = useSyncExternalStore(
        store.subscribe,
        () => key ? store.getSnapshot()?.[key] || null : null,
        () => key ? store.getSnapshot()?.[key] || null : null,
    );

    return {
        error,
        registerValidator, clearFieldError, runFieldValidation
    };
};
