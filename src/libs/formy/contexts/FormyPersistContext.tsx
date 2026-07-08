import { createContext } from "react";
import type { FormyPersistAdapter } from "../types";

/**
 * Hook adapter: accepts a formId, returns a persist adapter object.
 * The concrete implementation (Zustand, Redux, etc.) is injected
 * into this context externally, e.g. via FormStoreProvider.
 */
export type FormyPersistHook = (formId: string) => FormyPersistAdapter;

const noopPersistHook: FormyPersistHook = () => ({
    getValues: () => undefined,
    setValue: () => {},
    clear: () => {},
});

/**
 * Default value is a working no-op stub (not null).
 * This allows Formy to unconditionally call usePersist(...)
 * without extra null-checks on context existence.
 */
export const FormyPersistContext = createContext<FormyPersistHook>(noopPersistHook);
