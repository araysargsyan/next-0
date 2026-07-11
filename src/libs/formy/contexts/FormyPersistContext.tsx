import { createContext } from "react";
import {FormyPersistHook} from "../types";

const noopPersistHook: FormyPersistHook = () => ({
    getValues: () => undefined,
    setValue: () => undefined,
    clear: () => undefined,
});

/**
 * Default value is a working no-op stub (not null).
 * This allows Formy to unconditionally call usePersist(...)
 * without extra null-checks on context existence.
 */
export const FormyPersistContext = createContext<FormyPersistHook>(noopPersistHook);
