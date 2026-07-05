import { createContext } from "react";
import type { FormyActionState } from "../types";

export interface FormyContextValue {
    state: FormyActionState | null;
    isPending: boolean;
    registerValidator?: (name: string, validateFn: (value: string) => string | null) => () => void;
}

export const FormyContext = createContext<FormyContextValue>({
    state: null,
    isPending: false,
});
