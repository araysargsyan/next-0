import { createContext } from "react";

export interface FormyModeContextValue {
    plainMode?: boolean;
    clearOnSuccess?: boolean;
}

export const FormyModeContext = createContext<FormyModeContextValue>({
    plainMode: false,
    clearOnSuccess: true,
});


