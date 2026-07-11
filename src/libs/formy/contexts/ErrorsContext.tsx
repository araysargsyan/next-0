"use client";
import {createContext} from "react";
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
