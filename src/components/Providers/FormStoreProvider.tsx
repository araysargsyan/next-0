"use client";
import { createContext, useState, type ReactNode } from "react";
import { createFormStore } from "@/store/formStore";

const FormStoreContext = createContext<ReturnType<typeof createFormStore> | null>(null);

export default function FormStoreProvider({ children }: { children: ReactNode }) {
    const [store] = useState(() => createFormStore());

    return (
        <FormStoreContext.Provider value={store}>
            {children}
        </FormStoreContext.Provider>
    );
}
