"use client"

import {
    useContext,
    useRef,
    cloneElement,
    useCallback,
    useLayoutEffect,
    type ChangeEvent
} from "react";
import {FormyContext, FormyModeContext} from "../../contexts";
import {useFormyErrors} from "../../hooks";
import {createLogger} from "@/libs/utils/logger";
import {DynamicInputProps} from "@/libs/formy/types";


const log = createLogger("RestoreInputValue", "cyan");
export function RestoreInputValue({
    children, type, onChange
}: DynamicInputProps) {
    const {state} = useContext(FormyContext)
    const {clearOnSuccess} = useContext(FormyModeContext)
    const value = useRef<string | null>(null)
    const {clearFieldError, runFieldValidation} = useFormyErrors()
    const inputRef = useRef<HTMLInputElement>(null)

    useLayoutEffect(() => {
        log(`🔄 RestoreInputValue render`);
    });

    useLayoutEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        log("restoring value", {state, value: value.current})

        if (state && "data" in state) {
            if (clearOnSuccess) {
                value.current = null
                return;
            }
        }

        if (!value.current) return;

        if (type === "checkbox") {
            el.checked = value.current === "true";
        } else if (type === "radio") {
            el.checked = el.value === value.current;
        } else {
            el.value = value.current || '';
        }
    }, [state, clearOnSuccess, type])


    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        log("handleChange", {value: value.current})
        const target = e.target;

        runFieldValidation(target.name, target.value)

        if (target.type === "checkbox") {
            value.current = target.checked ? "true" : "false";
        } else if (target.type === "radio") {
            if (target.checked) {
                value.current = target.value;
            }
        } else {
            value.current = target.value;
        }

        if (target.name) {
            clearFieldError?.(target.name);
        }
        onChange?.(e);
    }, [clearFieldError, onChange, runFieldValidation]);

    // eslint-disable-next-line react-hooks/refs
    return cloneElement(children, {
        ref: inputRef,
        onChange: handleChange
    })
}

