"use client";
import {createContext} from "react";
import type { ErrorsStore } from "../utils/createErrorsStore";

export interface ErrorsContextValue {
    store: ErrorsStore;
    clearFieldError: (name: string) => void;
    registerValidator: (
        name: string,
        validateFn: (value: string) => string | null,
        setErrorFn: (error: string | null) => void
    ) => () => void;
    runFieldValidation: (name: string, value: string) => void;
}

export const ErrorsContext = createContext<ErrorsContextValue | null>(null);
