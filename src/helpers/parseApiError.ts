import { ApiErrorPayload, ApiErrorResponse } from "@/app/types";

export type ParsedApiError = string | Record<string, string>;

/**
 * Parses NestJS API errors to extract readable validation or exception messages.
 * Returns either a string (for global errors) or a Record of field names to error messages.
 */
export function parseApiError(errBody: unknown): ParsedApiError {
    const fallback = "Something went wrong. Please try again later.";
    if (!errBody || typeof errBody !== "object") {
        return fallback;
    }

    const payload = errBody as ApiErrorPayload;
    const detailSource = payload.errorResponse || payload.exception?.response || payload.errors;

    // 1. If errors is a raw string
    if (typeof detailSource === "string") {
        return detailSource;
    }

    // 2. If errors is an object
    if (detailSource && typeof detailSource === "object") {
        const objSource = detailSource as ApiErrorResponse;
        const innerMessage = objSource.message;
        
        // Prioritize standard NestJS global message inside detailSource
        if (innerMessage) {
            return Array.isArray(innerMessage)
                ? innerMessage.filter((v): v is string => typeof v === "string").join(", ")
                : (typeof innerMessage === "string" ? innerMessage : fallback);
        }

        // Extract field validation errors
        const fieldErrors: Record<string, string> = {};
        Object.entries(objSource).forEach(([key, val]) => {
            if (key !== "statusCode" && key !== "error") {
                if (Array.isArray(val)) {
                    const msgs = val.filter((v): v is string => typeof v === "string").join(", ");
                    if (msgs) {
                        fieldErrors[key] = msgs;
                    }
                } else if (typeof val === "string") {
                    fieldErrors[key] = val;
                }
            }
        });

        if (Object.keys(fieldErrors).length > 0) {
            return fieldErrors;
        }
    }

    // 3. Fallback to root or exception level message
    const rootMessage = payload.message || payload.exception?.message;
    if (typeof rootMessage === "string") {
        return rootMessage;
    }

    const errRes = payload.errorResponse;
    const excRes = payload.exception?.response;
    const errs = payload.errors;
    
    const fallbackError = 
        (errRes && typeof errRes === "object" ? errRes.error : undefined) ||
        (excRes && typeof excRes === "object" ? excRes.error : undefined) ||
        (errs && typeof errs === "object" ? errs.error : undefined);
        
    if (typeof fallbackError === "string") {
        return fallbackError;
    }

    return fallback;
}
