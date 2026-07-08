import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthSDKConfig, ParsedCookie, RefreshResponse } from "./types";
import {createLogger} from "@/libs/utils/logger";


const log = createLogger('AuthService', 'green');

export class AuthService {
    private readonly config: DeepRequired<AuthSDKConfig>;

    constructor(config: AuthSDKConfig) {
        this.config = {
            apiUrl: config.apiUrl,
            cookieNames: {
                accessToken: config.cookieNames?.accessToken || "accessToken",
                refreshToken: config.cookieNames?.refreshToken || "refreshToken",
            },
            routes: {
                signOut: config.routes?.signOut || "/api/auth/sign-out",
                refreshAndReturn: config.routes?.refreshAndReturn || "/api/auth/refresh-and-return",
            },
            timeoutMs: config.timeoutMs ?? 5000,
        };
    }

    /**
     * MAIN METHOD: Performs proactive token refresh and Double Sync.
     */
    async getAuthorizedResponse(req: NextRequest): Promise<{ response: NextResponse, isRefreshed: boolean }> {
        const { pathname } = req.nextUrl;
        const accessTokenName = this.config.cookieNames.accessToken;
        const refreshTokenName = this.config.cookieNames.refreshToken;

        const accessToken = req.cookies.get(accessTokenName)?.value;
        const refreshToken = req.cookies.get(refreshTokenName)?.value;

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-url", req.url); // Save the exact requested URL
        let rawSetCookies: string[] = [];
        let isRefreshed = false;

        if (!accessToken && refreshToken) {
            log(`[AUTH]: (${pathname}) ->`, 'Access token missing. Attempting refresh...');

            const refresh = await this.refresh(refreshToken, pathname);

            if (refresh.success) {
                log(`[AUTH]: (${pathname}) ->`, 'Refresh successful. Performing Double Sync.');
                requestHeaders.set("Cookie", refresh.cookieString);
                rawSetCookies = refresh.rawSetCookies;
                isRefreshed = true;
            } else {
                log(`[FINISH]: (${pathname}) ->`, 'Refresh failed, forwarding to sign-out');
                return {
                    isRefreshed: false,
                    response: NextResponse.redirect(new URL(
                        `${this.config.routes.signOut}?error=session_expired`,
                        req.url
                    )),
                };
            }
        }

        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        if (rawSetCookies.length > 0) {
            log(`[AUTH]: (${pathname}) ->`, 'Committing refreshed cookies to browser');
            this.applySetCookies(response, rawSetCookies);
        }

        return { response, isRefreshed };
    }

    /**
     * PROTECTED FETCH: Automatically handles 401 and performs Silent Retry in Server Actions.
     */
    protFetch = async <TBody = unknown>(
        path: string,
        options: Omit<RequestInit, "body"> & { body?: TBody, isAction?: boolean } = {}
    ): Promise<Response> => {
        const { method = "GET", body, isAction = false, ...fetchOptions } = options;
        log(`[FETCH-START]: (${path})`, { method, isAction });

        const cookieStore = await cookies();
        const refreshTokenName = this.config.cookieNames.refreshToken;

        const getHeaders = () => {
            const h = new Headers(fetchOptions.headers || {});
            if (!(body instanceof FormData) && !h.has("Content-Type")) {
                h.set("Content-Type", "application/json");
            }
            h.set("Cookie", cookieStore.toString());
            return h;
        };

        const doFetch = () => fetch(`${this.config.apiUrl}${path}`, {
            method,
            headers: getHeaders(),
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
            ...fetchOptions,
            cache: "no-store",
        });

        try {
            let res = await doFetch();

            if (res.status === 401) {
                if (isAction) {
                    log(`[FETCH-ERROR]: (${path}) ->`, '401 Unauthorized in Action, attempting silent refresh and retry');

                    const refreshToken = cookieStore.get(refreshTokenName)?.value;
                    if (!refreshToken) {
                        log(`[FETCH-ERROR]: (${path}) ->`, 'No refresh token available, redirecting to sign-out');
                        return redirect(`${this.config.routes.signOut}?error=session_expired`);
                    }

                    const refresh = await this.refresh(refreshToken, path);

                    if (refresh.success) {
                        log(`[FETCH-AUTH]: (${path}) ->`, 'Refresh successful, committing cookies and retrying');
                        await this.commitCookies(refresh.rawSetCookies);

                        res = await doFetch();
                        log(`[FETCH-FINISH]: (${path}) ->`, 'Retry successful', { status: res.status });
                        return res;
                    } else {
                        log(`[FETCH-ERROR]: (${path}) ->`, 'Refresh failed in Action, redirecting to sign-out');
                        return redirect(`${this.config.routes.signOut}?error=session_expired`);
                    }
                } else {
                    log(`[FETCH-ERROR]: (${path}) ->`, '401 Unauthorized, redirecting to refresh route');
                    const headersStore = await headers();
                    const currentUrl = headersStore.get('x-url') || '';
                    const returnUrl = currentUrl
                        ? `${this.config.routes.refreshAndReturn}?returnUrl=${encodeURIComponent(currentUrl)}`
                        : this.config.routes.refreshAndReturn;
                    return redirect(returnUrl);
                }
            }

            log(`[FETCH-FINISH]: (${path}) ->`, { status: res.status });
            return res;
        } catch (e) {
            log(`[FETCH-ERROR]: (${path}) -> Connection failed`, String(e));
            return new Response(JSON.stringify({
                message: "Backend server is offline or unreachable."
            }), {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    /**
     * REANIMATOR: Handles the GET request on /api/auth/refresh-and-return.
     */
    async handleRefreshAndReturn(req: NextRequest): Promise<NextResponse> {
        const { searchParams } = new URL(req.url);
        const returnUrl = searchParams.get('returnUrl') || "/";

        log(`[REANIMATOR-START]: (${returnUrl})`, "Re-authenticating and returning");

        const cookieStore = await cookies();
        const refreshTokenName = this.config.cookieNames.refreshToken;
        const refreshToken = cookieStore.get(refreshTokenName)?.value;

        if (!refreshToken) {
            log(`[REANIMATOR-ERROR]: (${returnUrl}) ->`, 'No refresh token found');
            const signOutUrl = new URL(`${this.config.routes.signOut}?error=session_expired`, req.url);
            return NextResponse.redirect(signOutUrl);
        }

        const refresh = await this.refresh(refreshToken, returnUrl);

        if (refresh.success) {
            log(`[REANIMATOR-FINISH]: (${returnUrl}) ->`, 'Success, redirecting back');
            const response = NextResponse.redirect(new URL(returnUrl, req.url));
            this.applySetCookies(response, refresh.rawSetCookies);
            return response;
        }

        log(`[REANIMATOR-ERROR]: (${returnUrl}) ->`, 'Session dead');
        return NextResponse.redirect(new URL(
            `${this.config.routes.signOut}?error=session_expired`,
            req.url
        ));
    }

    /**
     * LOW-LEVEL REFRESH: Refreshes tokens against the backend.
     */
    async refresh(refreshToken: string, logPath: string = ''): Promise<RefreshResponse> {
        log(`[REFRESH-START]: (${logPath})`, 'Refreshing tokens...');

        try {
            const res = await fetch(`${this.config.apiUrl}/api/auth/refresh`, {
                method: "GET",
                headers: { Cookie: `${this.config.cookieNames.refreshToken}=${refreshToken}` },
                signal: AbortSignal.timeout(this.config.timeoutMs),
            });

            if (res.ok) {
                const rawSetCookies = res.headers.getSetCookie();

                if (rawSetCookies.length === 0) {
                    log(`[REFRESH-ERROR]: (${logPath}) ->`, 'Backend returned 200 but NO Set-Cookie headers');
                    return {success: false};
                }

                const cookieString = rawSetCookies
                    .map(s => s.split(';')[0])
                    .join("; ");

                log(`[REFRESH-FINISH]: (${logPath}) ->`, 'Success', { count: rawSetCookies.length });
                return {
                    success: true,
                    cookieString,
                    rawSetCookies
                };
            }

            log(`[REFRESH-ERROR]: (${logPath}) ->`, 'Backend rejected refresh', { status: res.status });
            return {success: false};
        } catch (e) {
            log(`[REFRESH-ERROR]: (${logPath}) ->`, 'Critical Error', String(e));
            return {success: false};
        }
    }

    /**
     * Appends raw Set-Cookie strings to a response (for Middleware / Route Handlers).
     */
    private applySetCookies(response: NextResponse, rawSetCookies: string[]): void {
        rawSetCookies.forEach(cookieStr => {
            response.headers.append('Set-Cookie', cookieStr);
        });
    }

    /**
     * Commits parsed cookies into the Next.js cookie store (for Actions / Route Handlers).
     */
    async commitCookies(rawSetCookies: string[]): Promise<void> {
        const cookieStore = await cookies();
        rawSetCookies.forEach(cookieStr => {
            const parsed = this.parseSetCookie(cookieStr);
            if (parsed) {
                const { name, value, ...opts } = parsed;
                cookieStore.set(name, value, opts);
            }
        });
    }

    /**
     * PARSER: Implements the parseSetCookie logic from Next.js.
     */
    parseSetCookie(setCookie: string): ParsedCookie | undefined {
        if (!setCookie) return undefined;

        const pairs: [string, string | boolean][] = setCookie.split(/; */).filter(Boolean).map(pair => {
            const index = pair.indexOf('=');
            if (index === -1) return [pair, true];
            return [pair.substring(0, index), pair.substring(index + 1)];
        });

        const [first, ...attributes] = pairs;
        const [name, value] = first as [string, string];

        const attrs = Object.fromEntries(
            attributes.map(([key, val]) => [
                key.toLowerCase().replace(/-/g, ""),
                val
            ])
        );

        const cookie: ParsedCookie = {
            name,
            value: decodeURIComponent(value),
        };

        if (attrs.domain) cookie.domain = attrs.domain as string;
        if (attrs.expires) cookie.expires = new Date(attrs.expires as string);
        if (attrs.httponly) cookie.httpOnly = true;
        if (attrs.maxage !== undefined && !isNaN(Number(attrs.maxage))) cookie.maxAge = Number(attrs.maxage);
        if (attrs.path) cookie.path = attrs.path as string;

        if (typeof attrs.samesite === 'string') {
            const ss = attrs.samesite.toLowerCase();
            if (['lax', 'strict', 'none'].includes(ss)) cookie.sameSite = ss as ParsedCookie['sameSite'];
        }

        if (attrs.secure) cookie.secure = true;

        if (typeof attrs.priority === 'string') {
            const p = attrs.priority.toLowerCase();
            if (['low', 'medium', 'high'].includes(p)) cookie.priority = p as ParsedCookie['priority'];
        }

        if (attrs.partitioned) cookie.partitioned = true;

        // Final cleanup: remove only undefined values (empty strings are kept so cookies can be cleared correctly)
        return Object.fromEntries(
            Object.entries(cookie).filter(([_, v]) => v !== undefined)
        ) as ParsedCookie;
    }
}
