"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { createErrorsStore } from "../utils/createErrorsStore";
import type { FormyActionState } from "../types";

export function useFormyErrors(state: FormyActionState | null, isPending: boolean) {
    const errors = useMemo(() => {
        const stateError = state && "error" in state ? state.error : null;

        return isPending
                ? null : typeof stateError === 'string'
                    ? {'__global__': stateError}
                    : stateError || null;
    }, [isPending, state]);

    const [errorsStore] = useState(() => createErrorsStore(errors));
    
    useEffect(() => {
        errorsStore.setErrors(errors);
    }, [errors, errorsStore]);

    const clearFieldError = useCallback((name: string) => {
        const currentErrors = errorsStore.getSnapshot();
        if (!currentErrors) return;

        if (currentErrors['__global__']) {
            const newErrors = { ...currentErrors };
            delete newErrors['__global__'];
            errorsStore.setErrors(Object.keys(newErrors).length > 0 ? newErrors : null);
        } else if (currentErrors[name]) {
            const newErrors = { ...currentErrors };
            delete newErrors[name];
            errorsStore.setErrors(Object.keys(newErrors).length > 0 ? newErrors : null);
        }
    }, [errorsStore]);

    return { errorsStore, clearFieldError };
}
