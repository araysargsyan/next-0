"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useStore } from "zustand";
import { createFormStore, FormStore } from "@/lib/store/formStore";

export const FormStoreContext = createContext<ReturnType<typeof createFormStore> | null>(null);

export interface FormStoreProviderProps {
    children: ReactNode;
}

export default function FormStoreProvider({ children }: FormStoreProviderProps) {
    const [store] = useState(() => createFormStore());

    return (
        <FormStoreContext.Provider value={store}>
            {children}
        </FormStoreContext.Provider>
    );
}

export function useFormStore<T>(selector: (store: FormStore) => T): T {
    const context = useContext(FormStoreContext);
    if (!context) {
        throw new Error("useFormStore must be used within a FormStoreProvider");
    }
    return useStore(context, selector);
}
