"use client";

import {memo, useEffect, useLayoutEffect, useState} from "react";
import type { FormyErrorProps } from "../types";
import {useFormyErrors} from "../hooks";
import { createLogger } from "@/libs/utils/logger";

const log = createLogger("FormyError", "red");
export const FormyError = memo(function FormyError({
    field = '__global__',
    helpText,
    parseMessage,
    validate,
    children,
    className = "",
    style
}: FormyErrorProps) {
    const {error: stateError, registerValidator} = useFormyErrors(field);
    const [clientError, setClientError] = useState<string | null>(null);

    useLayoutEffect(() => {
        log(`[${field ?? "global"}] 🔄 render`, { clientError, stateError });
    });

    useEffect(() => {
        log(`[${field ?? "global"}] 📝 clientError changed:`, clientError ?? "null");
    }, [clientError, field]);

    useEffect(() => {
        if (!registerValidator) return;

        if (validate && field) {
            const setErrorFn = (err: string | null) => setClientError(err);
            return registerValidator(field, validate, setErrorFn);
        } else if (!field) {
            return registerValidator("__global__", () => null, () => {});
        }
    }, [field, validate, registerValidator]);

    const error = clientError ? clientError : stateError;
    let titleText = "";
    let infoText = helpText ?? "";

    if (error) {
        if (parseMessage) {
            const parsed = parseMessage(error);
            titleText = parsed.title;
            infoText = parsed.info ?? infoText;
        } else {
            titleText = error;
        }
    }

    if (typeof children === "function") {
        return children(error, infoText);
    }

    if (!error) return null;

    return (
        <div className={className} style={style}>
            {children || (
                <>
                    {titleText}
                    {infoText && ` (${infoText})`}
                </>
            )}
        </div>
    );
});
