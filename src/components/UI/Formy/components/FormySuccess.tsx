"use client";

import { useContext, type ReactNode } from "react";
import { FormyContext } from "../contexts/FormyContext";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import { createLogger } from "@/lib/logger";

const log = createLogger("FormySuccess", "green");

export function FormySuccess({ children }: { children: ReactNode }) {
    const { state } = useContext(FormyContext);
    const isSuccess = !!(state && "success" in state && state.success);

    useIsomorphicLayoutEffect(() => {
        log(`🔄 render`, { isSuccess });
    });

    if (isSuccess) {
        return <>{children}</>;
    }
    return null;
}
