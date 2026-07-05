"use client";

import { type ReactNode } from "react";
import { FormyPersistContext } from "../contexts/FormyPersistContext";
import { FormyStoreSlice, UseStoreHook } from "../types";
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
 *   const FormyZustandBridge = createPersistBridge(useFormStore);
 */
export function createPersistBridge<Store extends FormyStoreSlice>(
    useStoreHook: UseStoreHook<Store>
) {
    return function FormyPersistBridge({ children }: { children: ReactNode }) {
        return (
            <FormyPersistContext.Provider value={usePersistedForm.bind(null, useStoreHook)}>
                {children}
            </FormyPersistContext.Provider>
        );
    };
}
