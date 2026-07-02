import { ApiErrorPayload, ApiErrorResponse } from "@/app/types";

/**
 * Parses NestJS API errors to extract readable validation or exception messages.
 */
export function parseApiError(errBody: unknown): string {
    const fallback = "Something went wrong. Please try again later.";
    if (!errBody || typeof errBody !== "object") {
        return fallback;
    }

    const payload = errBody as ApiErrorPayload;
    const detailSource = payload.errorResponse || payload.exception?.response || payload.errors;
    const messagesList: string[] = [];

    // 1. Prioritize detailed field validation errors
    if (typeof detailSource === "string") {
        messagesList.push(detailSource);
    } else if (detailSource && typeof detailSource === "object") {
        const objSource = detailSource as ApiErrorResponse;
        const innerMessage = objSource.message;
        
        if (innerMessage) {
            if (Array.isArray(innerMessage)) {
                messagesList.push(...innerMessage.filter((v): v is string => typeof v === "string"));
            } else if (typeof innerMessage === "string") {
                messagesList.push(innerMessage);
            }
        } else {
            Object.entries(objSource).forEach(([key, val]) => {
                if (key !== "statusCode" && key !== "error") {
                    if (Array.isArray(val)) {
                        messagesList.push(...val.filter((v): v is string => typeof v === "string"));
                    } else if (typeof val === "string") {
                        messagesList.push(val);
                    }
                }
            });
        }
    }

    // 2. Fallback to root or exception level message
    if (messagesList.length === 0) {
        const rootMessage = (payload as any).message || payload.exception?.message;
        if (typeof rootMessage === "string") {
            messagesList.push(rootMessage);
        } else {
            const errRes = payload.errorResponse;
            const excRes = payload.exception?.response;
            const errs = payload.errors;
            
            const fallbackError = 
                (errRes && typeof errRes === "object" ? errRes.error : undefined) ||
                (excRes && typeof excRes === "object" ? excRes.error : undefined) ||
                (errs && typeof errs === "object" ? errs.error : undefined);
                
            if (typeof fallbackError === "string") {
                messagesList.push(fallbackError);
            }
        }
    }

    return messagesList.length > 0
        ? messagesList.filter(Boolean).join(", ")
        : fallback;
}
