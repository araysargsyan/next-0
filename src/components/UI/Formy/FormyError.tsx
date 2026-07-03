'use client'
import { useContext } from "react";
import { FormyContext } from "./FormyContext";

interface FormyErrorProps {
    field?: string;
    below?: boolean;
    hasHelp?: boolean;
    helpText?: string;
    parseMessage?: (message: string) => { title: string; info: string };
}

export default function FormyError({
    field,
    below = false,
    hasHelp = false,
    helpText = "",
    parseMessage
}: FormyErrorProps) {
    const { state } = useContext(FormyContext);
    const stateError = state && "error" in state ? state.error : null;

    let error: string | null = null;
    let titleText = "";
    let infoText = helpText;

    if (stateError) {
        if (typeof stateError === "string") {
            // Global error (render only if field prop is omitted)
            if (!field) {
                error = stateError;
            }
        } else if (typeof stateError === "object") {
            // Field-specific error (render only if field matches a key)
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

    // Positions and transitions fully controlled via standard CSS
    const topStyle = below ? "100%" : "0";
    
    // Slide animation styles:
    // - If below: slide down slightly when entering (translateY(0px) -> translateY(4px))
    // - If above: slide up slightly when entering (translateY(-100%) -> translateY(calc(-100% - 4px)))
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

            {/* Info icon with premium glassmorphism tooltip */}
            {hasHelp && infoText && (
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

                    {/* Tooltip: glassmorphism, shadow, smooth scale animation */}
                    <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5
                        bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 text-zinc-100 text-[11px]
                        leading-relaxed rounded-lg shadow-2xl opacity-0 scale-95 origin-bottom
                        group-hover:opacity-100 group-hover:scale-100 pointer-events-none
                        transition-all duration-200 ease-out z-[99] font-normal"
                    >
                        {infoText}
                        {/* Tooltip arrow */}
                        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
                    </span>
                </span>
            )}
        </div>
    );
}
