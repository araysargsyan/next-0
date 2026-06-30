
type RefreshResponse =
    | {
    success: true;
    cookieString: string;
    rawSetCookies: string[];
}
    | {
    success: false;
};

interface ParsedCookie {
    name: string;
    value: string;
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
    priority?: 'low' | 'medium' | 'high';
    partitioned?: boolean;
}

interface AuthSDKConfig {
    apiUrl: string;
    cookieNames?: {
        accessToken?: string;
        refreshToken?: string;
    };
    routes?: {
        signOut?: string;
        refreshAndReturn?: string;
    };
    timeoutMs?: number;
}

export type {RefreshResponse, ParsedCookie, AuthSDKConfig};
