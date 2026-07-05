'use client'
import { useContext, ReactNode } from "react";
import { FormyContext } from "../contexts/FormyContext";

export function FormySuccess({ children }: { children: ReactNode }) {
    const { state } = useContext(FormyContext);
    if (state && "success" in state && state.success) {
        return <>{children}</>;
    }
    return null;
}
