"use client";

import { useLayoutEffect } from "react";
import type {FieldsetBarrierProps} from "../../types";
import { createLogger } from "@/libs/utils/logger";

const log = createLogger("FieldsetBarrier", "cyan");
export function FieldsetBarrier({ fieldsetRef, active, children }: FieldsetBarrierProps) {
    useLayoutEffect(() => {
        if (!active) return;
        log("engine mounted, enabling fieldset");
        if (fieldsetRef.current) {
            fieldsetRef.current.disabled = false;
        }
    }, [active, fieldsetRef]);

    if (!active) return <>{children}</>;

    return (
        <fieldset ref={fieldsetRef} disabled style={{ display: "contents" }}>
            {children}
        </fieldset>
    );
}
