"use client";

import type { FormyStoreSlice, FormyPersistAdapter, GetStateFn } from "../types";

export function usePersistedForm<Store extends FormyStoreSlice>(
    getState: GetStateFn<Store>,
    formId: string
): FormyPersistAdapter {
    return {
        getValues: () => formId ? getState().forms[formId] : undefined,
        setValue: (name: string, value: string) => {
            if (formId) getState().setFormValue(formId, name, value);
        },
        clear: () => {
            if (formId) getState().clearForm(formId);
        },
    };
}
