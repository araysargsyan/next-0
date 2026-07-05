import { createContext } from "react";
import type { FormyActionState } from "./types";

export interface FormyContextValue {
    state: FormyActionState | null;
    isPending: boolean;
}

export const FormyContext = createContext<FormyContextValue>({
    state: null,
    isPending: false,
});
