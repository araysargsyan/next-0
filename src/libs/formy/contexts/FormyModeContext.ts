import { createContext } from "react";

export interface FormyModeContextValue {
    staticMode?: boolean;
    clearOnSuccess?: boolean;
}

export const FormyModeContext = createContext<FormyModeContextValue>( {
    staticMode: true,
    clearOnSuccess: true,
});


