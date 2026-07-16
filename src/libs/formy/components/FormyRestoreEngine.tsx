"use client";

import { useContext, useEffect, useLayoutEffect, useRef} from "react";
import { FormyContext, FormyModeContext } from "../contexts";
import { useFormyErrors } from "../hooks";
import type {FormyRestoreEngineProps} from "../types";
import { createLogger } from "@/libs/utils/logger";

const log = createLogger("FormyRestoreEngine", "yellow");

export default function FormyRestoreEngine({ formRef }: FormyRestoreEngineProps) {
    useLayoutEffect(() => {log(`🔄 render`)});
    const { state } = useContext(FormyContext);
    const { clearOnSuccess } = useContext(FormyModeContext);
    const savedValues = useRef<Map<string, string>>(new Map());
    const { clearFieldError, runFieldValidation } = useFormyErrors();

    // Capture user input values via event delegation on the form element.
    useEffect(() => {
        const form = formRef.current;
        if (!form) return;
        const handler = (e: Event) => {
            const target = e.target;

            if (
                !(target instanceof HTMLInputElement) &&
                !(target instanceof HTMLSelectElement) &&
                !(target instanceof HTMLTextAreaElement)
            ) return;

            if (!target.hasAttribute("data-formy-input")) return;
            if (!target.name) return;

            runFieldValidation(target.name, target.value);
            clearFieldError?.(target.name);

            if (target instanceof HTMLInputElement && target.type === "checkbox") {
                savedValues.current.set(target.name, target.checked ? "true" : "false");
            } else if (target instanceof HTMLInputElement && target.type === "radio") {
                if (target.checked) savedValues.current.set(target.name, target.value);
            } else {
                savedValues.current.set(target.name, target.value);
            }
        };

        // "input" covers text/select/textarea; "change" covers checkbox/radio reliably across browsers.
        form.addEventListener("input", handler);
        form.addEventListener("change", handler);
        return () => {
            form.removeEventListener("input", handler);
            form.removeEventListener("change", handler);
        };
    }, [formRef, clearFieldError, runFieldValidation]);

    // Restore saved values after each Server Action completes.
    useLayoutEffect(() => {
        const form = formRef.current;
        if (!form) return;

        if (state && "data" in state && clearOnSuccess) {
            savedValues.current.clear();
            return;
        }

        for (const [name, val] of savedValues.current) {
            const el = form.elements.namedItem(name);
            if (!el) continue;

            if (el instanceof RadioNodeList) {
                for (const node of el) {
                    if (node instanceof HTMLInputElement) {
                        node.checked = node.value === val;
                    }
                }
            } else if (el instanceof HTMLInputElement) {
                if (el.type === "checkbox") el.checked = val === "true";
                else el.value = val;
            } else if (
                el instanceof HTMLSelectElement ||
                el instanceof HTMLTextAreaElement
            ) {
                el.value = val;
            }
        }
    }, [state, clearOnSuccess, formRef]);

    return null;
}
