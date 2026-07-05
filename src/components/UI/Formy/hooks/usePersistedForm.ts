"use client";

import type { FormyStoreSlice, UseStoreHook } from "../types";

export function usePersistedForm<Store extends FormyStoreSlice>(
    useStoreHook: UseStoreHook<Store>,
    formId: string
) {
    const values = useStoreHook((s) => formId ? s.forms[formId] : undefined);
    const setFormValue = useStoreHook((s) => s.setFormValue);
    const clearForm = useStoreHook((s) => s.clearForm);

    return {
        values,
        setValue: (name: string, value: string) => {
            if (formId) setFormValue(formId, name, value);
        },
        clear: () => {
            if (formId) clearForm(formId);
        },
    };
}
