"use client"

import { useContext } from "react";
import { FormyModeContext } from "../../contexts";
import dynamic from "next/dynamic";
import {DynamicInputProps} from "@/libs/formy/types";

const RestoreInputValue = dynamic(() =>
    import("./RestoreInputValue").then(m => ({ default: m.RestoreInputValue }))
);

export function DynamicInput({ children, type, onChange }: DynamicInputProps) {
    const { staticMode } = useContext(FormyModeContext);

    if (!staticMode) {
        return children;
    }

    return (
        <RestoreInputValue type={type} onChange={onChange}>
            {children}
        </RestoreInputValue>
    );
}
