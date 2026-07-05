"use client";

import { useMemo, type ReactNode } from "react";
import { FormyPersistContext } from "./FormyPersistContext";
import {FormyStoreSlice, UseStoreHook} from "./types";

/**
 * Создаёт Provider-компонент, который подключает ЛЮБОЙ стор,
 * соответствующий контракту FormyStoreSlice (секция `forms` + 3 экшна),
 * к FormyPersistContext.
 *
 * Formy сам по себе ничего не знает про Zustand/Redux/Jotai —
 * эта фабрика инкапсулирует адаптацию конкретного стора
 * в generic-контракт, который понимает Formy.
 *
 * Использование:
 *   const FormyZustandBridge = createFormyPersistBridge(useFormStore);
 */
export function createFormyPersistBridge<Store extends FormyStoreSlice>(
    useStoreHook: UseStoreHook<Store>
) {
    function usePersistHook(formId: string) {
        const values = useStoreHook((s) => s.forms[formId]);
        const setFormValue = useStoreHook((s) => s.setFormValue);
        const clearForm = useStoreHook((s) => s.clearForm);

        return useMemo(
            () => ({
                values,
                setValue: (name: string, value: string) => setFormValue(formId, name, value),
                clear: () => clearForm(formId),
            }),
            [values, setFormValue, clearForm, formId]
        );
    }

    return function FormyPersistBridge({ children }: { children: ReactNode }) {
        return (
            <FormyPersistContext.Provider value={usePersistHook}>
                {children}
            </FormyPersistContext.Provider>
        );
    };
}

export function createUseStoreHook<T extends FormyStoreSlice>(hook: UseStoreHook<T>): UseStoreHook<T> {
    return hook
}
