export interface ApiErrorResponse {
    message?: string | string[];
    error?: string;
    statusCode?: number;
    [key: string]: unknown;
}

export interface ApiErrorPayload {
    exception?: {
        response?: ApiErrorResponse | string;
        status?: number;
        message?: string;
        name?: string;
    };
    status?: number;
    errorResponse?: ApiErrorResponse | string;
    errors?: ApiErrorResponse | string;
}
