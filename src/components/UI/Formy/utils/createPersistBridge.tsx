"use client";

import { type ReactNode, useMemo } from "react";
import { FormyPersistContext } from "../contexts/FormyPersistContext";
import { FormyStoreSlice, GetStateFn } from "../types";
import { usePersistedForm } from "../hooks/usePersistedForm";

/**
 * Creates a Provider component that connects ANY store conforming to
 * the FormyStoreSlice contract (`forms` record + `setFormValue` / `clearForm`)
 * to FormyPersistContext.
 *
 * Formy itself has zero knowledge of Zustand/Redux/Jotai —
 * this factory encapsulates the adaptation of a specific store
 * into the generic contract that Formy understands.
 *
 * Usage:
 *   const FormyZustandBridge = createPersistBridge(() => useContext(StoreContext).getState);
 */
export function createPersistBridge<Store extends FormyStoreSlice>(
    useGetState: () => GetStateFn<Store>
) {
    return function FormyPersistBridge({ children }: { children: ReactNode }) {
        const getState = useGetState();
        const persistHook = useMemo(
            () => usePersistedForm.bind(null, getState),
            [getState]
        );
        return (
            <FormyPersistContext.Provider value={persistHook}>
                {children}
            </FormyPersistContext.Provider>
        );
    };
}
