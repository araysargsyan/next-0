"use client";

import { FormyError } from "@/libs/formy";
import {CSSProperties, memo} from "react";

interface FieldErrorProps {
    field?: string;
    validate?: (value: string) => string | null;
    parseMessage?: (message: string) => { title: string; info?: string };
    /**
     * When true, the error is positioned absolutely above its container
     * (used for the global error above the submit button).
     * When false (default), the error is positioned absolutely below the input.
     */
    above?: boolean;
    className?: string;
    style?: CSSProperties;
}

function FieldErrorComponent({
    field = "__global__",
    validate,
    parseMessage,
    above = false,
    className = "",
    style
}: FieldErrorProps) {
    return (
        <FormyError
            field={field}
            validate={validate}
            parseMessage={parseMessage}
        >
            {(error, infoText) => {
                const isVisible = !!error;
                const isBelow = !above;

                let transformStyle = "";
                if (isBelow) {
                    transformStyle = isVisible ? "translateY(0px)" : "translateY(-8px)";
                } else {
                    transformStyle = isVisible ? "translateY(-100%)" : "translateY(calc(-100% + 8px))";
                }

                const transitionStyle: CSSProperties = {
                    ...style,
                    position: "absolute",
                    top: isBelow ? "100%" : "0",
                    left: 0,
                    right: 0,
                    transform: transformStyle,
                    opacity: isVisible ? 1 : 0,
                    pointerEvents: isVisible ? "auto" : "none",
                    transition: "opacity 0.2s ease-in-out, transform 0.2s ease-in-out",
                };

                const resolvedClassName = className || "text-rose-800 text-sm flex items-center gap-1.5";

                return (
                    <div className={resolvedClassName} style={transitionStyle}>
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <div className="font-medium">{error || ""}</div>
                        {infoText && (
                            <span className="relative group cursor-pointer inline-flex items-center ml-1">
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
                        )}
                    </div>
                );
            }}
        </FormyError>
    );
}

export const FieldError = memo(FieldErrorComponent);

