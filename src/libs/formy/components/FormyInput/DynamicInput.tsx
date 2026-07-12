'use client'

import {useContext} from "react";
import {FormyModeContext} from "../../contexts";
import type {FormyInputProps} from "../../types";
import dynamic from "next/dynamic";

const RestoreInputValue = dynamic(() =>
    import("./RestoreInputValue").then(m => ({ default: m.RestoreInputValue }))
);

export function DynamicInput(props: FormyInputProps) {
    const {plainMode} = useContext(FormyModeContext)

    if (plainMode) {
        return <input {...props} />
    }

    return <RestoreInputValue
        type={props.type}
        onChange={props.onChange}
    >
        <input {...props} />
    </RestoreInputValue>
}
