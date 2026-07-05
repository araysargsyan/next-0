"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createFormStore } from "@/lib/store/formStore";
import { createFormyPersistBridge } from "@/components/UI/Formy";

const FormStoreContext = createContext<ReturnType<typeof createFormStore> | null>(null);

// Вызывается ОДИН РАЗ на уровне модуля, при загрузке файла —
// не во время рендера какого-либо компонента.
const FormyZustandBridge = createFormyPersistBridge((selector) => {
    const context = useContext(FormStoreContext);
    if (!context) {
        throw new Error("useFormStore must be used within a FormStoreProvider");
    }
    return useStore(context, selector);
});

export default function FormStoreProvider({ children }: { children: ReactNode }) {
    const [store] = useState(() => createFormStore());

    return (
        <FormStoreContext.Provider value={store}>
            <FormyZustandBridge>{children}</FormyZustandBridge>
        </FormStoreContext.Provider>
    );
}
