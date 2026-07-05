'use client'
import { useContext, useEffect } from "react";
import { FormyContext } from "../contexts/FormyContext";

interface FormyErrorProps {
    field?: string;
    below?: boolean;
    hasHelp?: boolean;
    helpText?: string;
    parseMessage?: (message: string) => { title: string; info: string };
    absolute?: boolean;
    validate?: (value: string) => string | null;
}

export function FormyError({
    field,
    below = false,
    hasHelp = false,
    helpText = "",
    parseMessage,
    absolute = true,
    validate
}: FormyErrorProps) {
    const { state, registerValidator } = useContext(FormyContext);

    useEffect(() => {
        if (validate && field && registerValidator) {
            return registerValidator(field, validate);
        }
    }, [field, validate, registerValidator]);
    const stateError = state && "error" in state ? state.error : null;

    let error: string | null = null;
    let titleText = "";
    let infoText = helpText;

    if (stateError) {
        if (typeof stateError === "string") {
            if (!field) {
                error = stateError;
            }
        } else if (typeof stateError === "object") {
            if (field) {
                error = stateError[field] ?? null;
            }
        }
    }

    if (error) {
        if (parseMessage) {
            const parsed = parseMessage(error);
            titleText = parsed.title;
            infoText = parsed.info || infoText;
        } else {
            titleText = error;
        }
    }

    const helpIcon = hasHelp && infoText && (
        <span className="relative group cursor-pointer inline-flex items-center">
            <svg
                className="w-3.5 h-3.5 text-rose-500 hover:text-rose-700 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            <span
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5
                bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 text-zinc-100 text-[11px]
                leading-relaxed rounded-lg shadow-2xl opacity-0 scale-95 origin-bottom
                group-hover:opacity-100 group-hover:scale-100 pointer-events-none
                transition-all duration-200 ease-out z-[99] font-normal"
            >
                {infoText}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
            </span>
        </span>
    );

    if (!absolute) {
        return (
            <div
                style={{
                    opacity: error ? 1 : 0,
                    maxHeight: error ? "100px" : "0px",
                    overflow: "hidden",
                    transition: "opacity 0.2s ease-in-out, max-height 0.2s ease-in-out, margin 0.2s ease-in-out",
                    marginTop: error ? "12px" : "0px",
                    marginBottom: error ? "12px" : "0px",
                }}
                className="text-rose-800 text-sm flex items-center gap-1.5"
            >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <div className="font-medium">{titleText}</div>
                {helpIcon}
            </div>
        );
    }

    const topStyle = below ? "100%" : "0";
    const transformStyle = below
        ? (error ? "translateY(4px)" : "translateY(0px)")
        : (error ? "translateY(calc(-100% - 4px))" : "translateY(-100%)");

    return (
        <div
            style={{
                position: "absolute",
                top: topStyle,
                left: 0,
                right: 0,
                transform: transformStyle,
                opacity: error ? 1 : 0,
                transition: "opacity 0.2s ease-in-out, transform 0.2s ease-in-out",
                pointerEvents: error ? "auto" : "none",
            }}
            className="text-rose-800 text-sm flex items-center gap-1.5"
        >
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <div className="font-medium">{titleText}</div>
            {helpIcon}
        </div>
    );
}
