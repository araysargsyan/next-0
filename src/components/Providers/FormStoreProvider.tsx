"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createFormStore } from "@/store/formStore";
import { createPersistBridge } from "@/libs/formy";

const FormStoreContext = createContext<ReturnType<typeof createFormStore> | null>(null);

// Called ONCE at module level during file load —
// not during any component render.
const FormyZustandBridge = createPersistBridge(() => {
    const context = useContext(FormStoreContext);
    if (!context) {
        throw new Error("useFormStore must be used within a FormStoreProvider");
    }
    return context.getState;
});

export default function FormStoreProvider({ children }: { children: ReactNode }) {
    const [store] = useState(() => createFormStore());

    return (
        <FormStoreContext.Provider value={store}>
            <FormyZustandBridge>{children}</FormyZustandBridge>
        </FormStoreContext.Provider>
    );
}
