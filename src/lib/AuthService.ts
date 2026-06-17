import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { API_URL, BASE_URL } from "@/config";
import { createLogger } from "./logger";
import { redirect } from "next/navigation";

const log = createLogger('AuthService', 'green');

type TRefreshResponse =
    | {
        success: true;
        cookieString: string;
        rawSetCookies: string[];
    }
    | {
        success: false;
        errorRedirect: NextResponse;
    };

export class AuthService {
    private static activeRefreshPromise: Promise<TRefreshResponse> | null = null;

    /**
     * ГЛАВНЫЙ МЕТОД: Выполняет проактивный рефреш и Double Sync.
     */
    static async getAuthorizedResponse(req: NextRequest): Promise<{ response: NextResponse, isRefreshed: boolean }> {
        const { pathname } = req.nextUrl;
        const accessToken = req.cookies.get("accessToken")?.value;
        const refreshToken = req.cookies.get("refreshToken")?.value;

        const requestHeaders = new Headers(req.headers);
        let rawSetCookies: string[] = [];
        let isRefreshed = false;

        if (!accessToken && refreshToken) {
            log(`[AUTH]: (${pathname}) ->`, 'Access token missing. Attempting refresh...');

            const refresh = await this.refresh(pathname, req.url);

            if (refresh.success) {
                log(`[AUTH]: (${pathname}) ->`, 'Refresh successful. Performing Double Sync.');
                requestHeaders.set("Cookie", refresh.cookieString);
                rawSetCookies = refresh.rawSetCookies;
                isRefreshed = true;
            } else {
                log(`[FINISH]: (${pathname}) ->`, 'Refresh failed, forwarding to sign-out');
                return { response: refresh.errorRedirect, isRefreshed: false };
            }
        }

        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        if (rawSetCookies.length > 0) {
            log(`[AUTH]: (${pathname}) ->`, 'Committing refreshed cookies to browser');
            rawSetCookies.forEach(cookieStr => {
                response.headers.append('Set-Cookie', cookieStr);
            });
        }

        return { response, isRefreshed };
    }

    /**
     * ПРОДВИНУТЫЙ FETCH: Автоматически обрабатывает 401 и делает Silent Retry в экшенах.
     */
    static async protFetch<TBody = unknown>(
        path: string,
        options: Omit<RequestInit, "body"> & { body?: TBody, isAction?: boolean } = {}
    ): Promise<Response> {
        const { method = "GET", body, isAction = false, ...fetchOptions } = options;
        log(`[FETCH-START]: (${path})`, { method, isAction });

        const cookieStore = await cookies();
        const headersList = await headers();
        const currentUrl = headersList.get('referer') || BASE_URL;

        const getHeaders = () => {
            const h = new Headers(fetchOptions.headers || {});
            if (!(body instanceof FormData) && !h.has("Content-Type")) {
                h.set("Content-Type", "application/json");
            }
            h.set("Cookie", cookieStore.toString());
            return h;
        };

        const doFetch = () => fetch(`${API_URL}${path}`, {
            method,
            headers: getHeaders(),
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
            ...fetchOptions,
            cache: "no-store",
        });

        let res = await doFetch();

        if (res.status === 401) {
            if (isAction) {
                log(`[FETCH-ERROR]: (${path}) ->`, '401 Unauthorized in Action, attempting silent refresh and retry');

                const refresh = await this.refresh("");

                if (refresh.success) {
                    log(`[FETCH-AUTH]: (${path}) ->`, 'Refresh successful, committing cookies and retrying');

                    // Используем СОБСТВЕННЫЙ парсер (точно как в Next.js)
                    refresh.rawSetCookies.forEach(cookieStr => {
                        const parsed = this.parseSetCookie(cookieStr);
                        if (parsed) {
                            const { name, value, ...opts } = parsed;
                            // @ts-ignore
                            cookieStore.set(name, value, opts);
                        }
                    });

                    res = await doFetch();
                    log(`[FETCH-FINISH]: (${path}) ->`, 'Retry successful', { status: res.status });
                    return res;
                } else {
                    log(`[FETCH-ERROR]: (${path}) ->`, 'Refresh failed in Action, redirecting to sign-out');
                    redirect(`/api/auth/sign-out?error=session_expired`);
                }
            } else {
                log(`[FETCH-ERROR]: (${path}) ->`, '401 Unauthorized, redirecting to refresh route');
                redirect(`/api/auth/refresh-and-return?returnUrl=${encodeURIComponent(currentUrl)}`);
            }
        }

        log(`[FETCH-FINISH]: (${path}) ->`, { status: res.status });
        return res;
    }

    /**
     * РЕАНИМАТОР: Обрабатывает GET запрос на /api/auth/refresh-and-return.
     */
    static async handleRefreshAndReturn(req: NextRequest): Promise<NextResponse> {
        const { searchParams } = new URL(req.url);
        const returnUrl = searchParams.get("returnUrl") || "/";

        log(`[REANIMATOR-START]: (${returnUrl})`, "Re-authenticating and returning");

        const refresh = await this.refresh(returnUrl, req.url);

        if (refresh.success) {
            log(`[REANIMATOR-FINISH]: (${returnUrl}) ->`, 'Success, redirecting back');
            const response = NextResponse.redirect(new URL(returnUrl, req.url));
            refresh.rawSetCookies.forEach(cookieStr => {
                response.headers.append('Set-Cookie', cookieStr);
            });
            return response;
        }

        log(`[REANIMATOR-ERROR]: (${returnUrl}) ->`, 'Session dead');
        return refresh.errorRedirect;
    }

    /**
     * НИЗКОУРОВНЕВЫЙ РЕФРЕШ: Обновляет токены на бэкенде с дедупликацией.
     */
    static async refresh(contextPath: string, reqUrl: string = BASE_URL): Promise<TRefreshResponse> {
        const safeUrl = new URL(contextPath || "", BASE_URL);
        const logPath = safeUrl.pathname;

        log(`[REFRESH-START]: (${logPath})`, 'Refreshing tokens...');

        if (this.activeRefreshPromise) {
            log(`[REFRESH-FINISH]: (${logPath}) ->`, 'Reusing existing refresh promise');
            return this.activeRefreshPromise;
        }

        this.activeRefreshPromise = (async (): Promise<TRefreshResponse> => {
            const signOutUrl = new URL("/api/auth/sign-out?error=session_expired", reqUrl);
            const errorResponse = {
                success: false as const,
                errorRedirect: NextResponse.redirect(signOutUrl)
            };

            try {
                const cookieStore = await cookies();
                const refreshToken = cookieStore.get("refreshToken")?.value;

                if (!refreshToken) {
                    log(`[REFRESH-ERROR]: (${logPath}) ->`, 'No refresh token found');
                    return errorResponse;
                }

                const res = await fetch(`${API_URL}/api/auth/refresh`, {
                    method: "GET",
                    headers: { Cookie: `refreshToken=${refreshToken}` },
                });

                if (res.ok) {
                    const rawSetCookies = res.headers.getSetCookie();

                    if (rawSetCookies.length === 0) {
                        log(`[REFRESH-ERROR]: (${logPath}) ->`, 'Backend returned 200 but NO Set-Cookie headers');
                        return errorResponse;
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
                return errorResponse;
            } catch (e) {
                log(`[REFRESH-ERROR]: (${logPath}) ->`, 'Critical Error', String(e));
                return errorResponse;
            } finally {
                this.activeRefreshPromise = null;
            }
        })();

        return this.activeRefreshPromise;
    }

    /**
     * ПРИВАТНЫЙ ПАРСЕР: Реализует логику parseSetCookie из Next.js.
     */
    private static parseSetCookie(setCookie: string) {
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

        const cookie: any = {
            name,
            value: decodeURIComponent(value),
        };

        if (attrs.domain) cookie.domain = attrs.domain;
        if (attrs.expires) cookie.expires = new Date(attrs.expires as string);
        if (attrs.httponly) cookie.httpOnly = true;
        if (attrs.maxage && Number(attrs.maxage) !== 0) cookie.maxAge = Number(attrs.maxage);
        if (attrs.path) cookie.path = attrs.path;
        
        if (typeof attrs.samesite === 'string') {
            const ss = attrs.samesite.toLowerCase();
            if (['lax', 'strict', 'none'].includes(ss)) cookie.sameSite = ss;
        }

        if (attrs.secure) cookie.secure = true;

        if (typeof attrs.priority === 'string') {
            const p = attrs.priority.toLowerCase();
            if (['low', 'medium', 'high'].includes(p)) cookie.priority = p;
        }

        if (attrs.partitioned) cookie.partitioned = true;

        // Финальная очистка: удаляем undefined и ПУСТЫЕ value (как в Next.js)
        return Object.fromEntries(
            Object.entries(cookie).filter(([k, v]) => {
                if (k === 'value' && v === '') return false;
                return v !== undefined;
            })
        );
    }
}

export const protFetch = AuthService.protFetch.bind(AuthService);
