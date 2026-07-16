"use client";

import { Suspense, useContext } from "react";
import dynamic from "next/dynamic";
import { FormyModeContext } from "../../contexts";
import type { DynamicInputProps } from "../../types";
import until from "@/libs/utils/until";

const RestoreInputValue = dynamic(() => until(3000).then(() => import("./RestoreInputValue")));

export function DynamicInput({ children, type, onChange }: DynamicInputProps) {
    const { staticMode } = useContext(FormyModeContext);

    if (!staticMode) {
        return children;
    }

    return (
        <Suspense fallback={children}>
            <RestoreInputValue type={type} onChange={onChange}>
                {children}
            </RestoreInputValue>
        </Suspense>
    );
}
