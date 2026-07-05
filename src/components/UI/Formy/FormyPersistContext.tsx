import { createContext } from "react";
import type { FormyPersistAdapter } from "./types";

/**
 * Хук-адаптер: принимает formId, возвращает объект persist-адаптера.
 * Конкретная реализация (Zustand, Redux, что угодно) кладётся
 * в этот контекст извне, например через FormStoreProvider.
 */
export type FormyPersistHook = (formId: string) => FormyPersistAdapter;

const noopPersistHook: FormyPersistHook = () => ({
    values: undefined,
    setValue: () => {},
    clear: () => {},
});

/**
 * Дефолтное значение — рабочая no-op заглушка, а не null.
 * Это позволяет Formy безусловно вызывать usePersist(...)
 * без дополнительных проверок на существование контекста.
 */
export const FormyPersistContext = createContext<FormyPersistHook>(noopPersistHook);
