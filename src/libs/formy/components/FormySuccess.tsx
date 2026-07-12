"use client";

import {type ReactNode, useLayoutEffect, useContext} from "react";
import { FormyContext } from "../contexts";
import { createLogger } from "@/libs/utils/logger";

const log = createLogger("FormySuccess", "green");

export function FormySuccess({ children }: { children: ReactNode }) {
    const { state } = useContext(FormyContext);
    const isSuccess = !!(state && "data" in state);

    useLayoutEffect(() => {
        log(`🔄 render`, { isSuccess });
    });

    if (isSuccess) {
        return <>{children}</>;
    }
    return null;
}
