import { createContext } from "react";
import { FormyActionState } from "./types";

export const FormyContext = createContext<{ state: FormyActionState | null; isPending: boolean }>({
    state: null,
    isPending: false
});
