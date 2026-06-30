import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { AuthService } from '../AuthService';

// ==========================================
// 1. Next.js Mock Setup for Server Modules
// ==========================================

// Lightweight mocks representing NextRequest & NextResponse interface definitions
class MockNextRequest {
    public nextUrl: { pathname: string };
    public cookies: { get: (name: string) => { value: string } | undefined };
    public headers: Headers;
    public url: string;

    constructor(url: string, init?: any) {
        this.url = url;
        const parsedUrl = new URL(url);
        this.nextUrl = { pathname: parsedUrl.pathname };
        this.headers = new Headers(init?.headers || {});

        const cookieHeader = this.headers.get('Cookie') || '';
        const cookiesMap: Record<string, string> = {};
        cookieHeader.split(';').forEach(c => {
            const parts = c.trim().split('=');
            if (parts[0]) {
                cookiesMap[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
            }
        });

        this.cookies = {
            get: (name: string) => {
                const val = cookiesMap[name];
                return val !== undefined ? { value: val } : undefined;
            }
        };
    }
}

class MockNextResponse {
    public headers = new Headers();
    public url?: string;
    public type: 'next' | 'redirect';
    public requestHeaders?: Headers;

    constructor(type: 'next' | 'redirect', url?: string, init?: any) {
        this.type = type;
        this.url = url;
        this.requestHeaders = init?.request?.headers;
    }

    static next(init?: any) {
        return new MockNextResponse('next', undefined, init);
    }

    static redirect(url: URL | string) {
        return new MockNextResponse('redirect', url.toString());
    }
}

// Monkey-patch next/server dynamically if running inside Next environment,
// otherwise relies entirely on constructor dependency injection.
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextServer = require('next/server');
    nextServer.NextRequest = MockNextRequest;
    nextServer.NextResponse = MockNextResponse;
} catch (_e) {
    // Fallback if CommonJS next modules cannot be resolved/mutated
}

// ==========================================
// 2. Mock Dependency Helpers for DIP
// ==========================================

class MockCookieStore {
    public store: Record<string, any> = {};

    get(name: string) {
        return this.store[name] !== undefined ? { value: this.store[name].value } : undefined;
    }

    set(name: string, value: string, options: any = {}) {
        this.store[name] = { value, options };
    }

    toString() {
        return Object.entries(this.store)
            .map(([k, v]) => `${k}=${v.value}`)
            .join('; ');
    }
}

class MockHeadersList {
    private headers = new Map<string, string>();

    set(key: string, val: string) {
        this.headers.set(key.toLowerCase(), val);
    }

    get(key: string) {
        return this.headers.get(key.toLowerCase()) || null;
    }
}

// ==========================================
// 3. Test Suites
// ==========================================

describe('AuthService Suite', () => {
    let mockCookies: MockCookieStore;
    let mockHeaders: MockHeadersList;
    let redirectSpy: any;
    let fetchSpy: any;
    let service: AuthService;
    let originalFetch: typeof global.fetch;

    const mockConfig = {
        apiUrl: 'http://backend:4400',
        cookieNames: {
            accessToken: 'access_tok',
            refreshToken: 'refresh_tok',
        },
        routes: {
            signOut: '/logout',
            refreshAndReturn: '/refresh-bounce',
        },
        timeoutMs: 1000,
    };

    beforeEach(() => {
        mockCookies = new MockCookieStore();
        mockHeaders = new MockHeadersList();
        redirectSpy = mock.fn((url: string) => {
            throw new Error(`REDIRECT_THROWN: ${url}`);
        });

        const deps = {
            cookies: () => mockCookies as any,
            headers: () => mockHeaders as any,
            redirect: redirectSpy,
        };

        service = new AuthService(mockConfig, deps);

        originalFetch = global.fetch;
        fetchSpy = mock.fn();
        global.fetch = fetchSpy as any;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        mock.reset();
    });

    // ==========================================
    // Suite 1: Cookie Parser & Commit
    // ==========================================
    describe('Suite 1: Cookie Parser & Commit', () => {
        it('1.1 should parse standard cookie headers with full attributes', () => {
            const setCookieHeader = 'session_id=12345abc; Domain=backend.com; Path=/api; Max-Age=3600; HttpOnly; Secure; SameSite=Lax; Priority=High; Partitioned';
            const parsed = service.parseSetCookie(setCookieHeader);

            assert.ok(parsed !== undefined);
            assert.strictEqual(parsed?.name, 'session_id');
            assert.strictEqual(parsed?.value, '12345abc');
            assert.strictEqual(parsed?.domain, 'backend.com');
            assert.strictEqual(parsed?.path, '/api');
            assert.strictEqual(parsed?.maxAge, 3600);
            assert.strictEqual(parsed?.httpOnly, true);
            assert.strictEqual(parsed?.secure, true);
            assert.strictEqual(parsed?.sameSite, 'lax');
            assert.strictEqual(parsed?.priority, 'high');
            assert.strictEqual(parsed?.partitioned, true);
        });

        it('1.2 should parse empty cookie values and keep them (empty value fix)', () => {
            const deleteCookieHeader = 'access_tok=; Path=/; Max-Age=0; HttpOnly; Secure';
            const parsed = service.parseSetCookie(deleteCookieHeader);

            assert.ok(parsed !== undefined);
            assert.strictEqual(parsed?.name, 'access_tok');
            assert.strictEqual(parsed?.value, '');
            assert.strictEqual(parsed?.maxAge, 0);
            assert.strictEqual(parsed?.path, '/');
        });

        it('1.3 should normalize SameSite and priority casing values', () => {
            const rawHeader = 'tok=abc; SameSite=STRICT; Priority=MEDIUM';
            const parsed = service.parseSetCookie(rawHeader);

            assert.strictEqual(parsed?.sameSite, 'strict');
            assert.strictEqual(parsed?.priority, 'medium');
        });

        it('1.4 should write parsed cookies correctly into cookieStore via commitCookies', async () => {
            const rawCookies = [
                'access_tok=new_access; Path=/; HttpOnly',
                'refresh_tok=new_refresh; Path=/; HttpOnly; Secure'
            ];

            await service.commitCookies(rawCookies);

            assert.strictEqual(mockCookies.get('access_tok')?.value, 'new_access');
            assert.strictEqual(mockCookies.get('refresh_tok')?.value, 'new_refresh');
            assert.strictEqual(mockCookies.store['refresh_tok'].options.secure, true);
        });
    });

    // ==========================================
    // Suite 2: Low-Level Token Refresh
    // ==========================================
    describe('Suite 2: Low-Level Token Refresh', () => {
        it('2.1 should return success, parsed cookies and raw list on backend 200 OK', async () => {
            fetchSpy.mock.mockImplementation(async () => {
                const headers = new Headers();
                headers.append('Set-Cookie', 'access_tok=token123; Path=/');
                headers.append('Set-Cookie', 'refresh_tok=token456; Path=/');
                return new Response(null, { status: 200, headers });
            });

            const result = await service.refresh('old_refresh_token', '/dashboard');

            assert.strictEqual(fetchSpy.mock.callCount(), 1);
            const callArgs = fetchSpy.mock.calls[0].arguments;
            assert.strictEqual(callArgs[0], 'http://backend:4400/api/auth/refresh');
            assert.strictEqual((callArgs[1] as any).headers.Cookie, 'refresh_tok=old_refresh_token');

            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.cookieString, 'access_tok=token123; refresh_tok=token456');
                assert.strictEqual(result.rawSetCookies.length, 2);
            }
        });

        it('2.2 should return failure if backend returns 200 but no Set-Cookie headers', async () => {
            fetchSpy.mock.mockImplementation(async () => {
                return new Response(null, { status: 200 });
            });

            const result = await service.refresh('old_refresh', '/dashboard');

            assert.strictEqual(result.success, false);
        });

        it('2.3 should return failure if backend rejects refresh (e.g., 401)', async () => {
            fetchSpy.mock.mockImplementation(async () => {
                return new Response(null, { status: 401 });
            });

            const result = await service.refresh('invalid_refresh', '/dashboard');

            assert.strictEqual(result.success, false);
        });

        it('2.4 should return failure and handle timeout abort cleanly', async () => {
            fetchSpy.mock.mockImplementation(async () => {
                throw new DOMException('The user aborted a request.', 'AbortError');
            });

            const result = await service.refresh('refresh_token', '/dashboard');

            assert.strictEqual(result.success, false);
        });
    });

    // ==========================================
    // Suite 3: Middleware Gateway
    // ==========================================
    describe('Suite 3: Middleware Gateway', () => {
        it('3.1 should return NextResponse.next() unmodified if access token is present', async () => {
            const req = new MockNextRequest('http://localhost:3000/dashboard', {
                headers: { Cookie: 'access_tok=existing_access' }
            }) as any;

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            assert.strictEqual(isRefreshed, false);
            assert.strictEqual((response as any).type, 'next');
            assert.ok((response as any).requestHeaders !== undefined);
            assert.strictEqual(fetchSpy.mock.callCount(), 0);
        });

        it('3.2 should return NextResponse.next() unmodified if both tokens are missing', async () => {
            const req = new MockNextRequest('http://localhost:3000/dashboard') as any;

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            assert.strictEqual(isRefreshed, false);
            assert.strictEqual((response as any).type, 'next');
            assert.strictEqual(fetchSpy.mock.callCount(), 0);
        });

        it('3.3 should perform Double Sync when access token is missing but refresh token exists', async () => {
            const req = new MockNextRequest('http://localhost:3000/profile', {
                headers: { Cookie: 'refresh_tok=active_refresh_token' }
            }) as any;

            fetchSpy.mock.mockImplementation(async () => {
                const headers = new Headers();
                headers.append('Set-Cookie', 'access_tok=new_access; Path=/');
                headers.append('Set-Cookie', 'refresh_tok=new_refresh; Path=/');
                return new Response(null, { status: 200, headers });
            });

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            assert.strictEqual(isRefreshed, true);
            assert.strictEqual((response as any).type, 'next');

            const requestHeaders = (response as any).requestHeaders;
            assert.strictEqual(requestHeaders.get('Cookie'), 'access_tok=new_access; refresh_tok=new_refresh');

            const responseCookies = response.headers.get('Set-Cookie');
            assert.ok(responseCookies.includes('access_tok=new_access; Path=/'));
            assert.ok(responseCookies.includes('refresh_tok=new_refresh; Path=/'));
        });

        it('3.4 should return sign-out redirect response if refresh token is expired/rejected in middleware', async () => {
            const req = new MockNextRequest('http://localhost:3000/dashboard', {
                headers: { Cookie: 'refresh_tok=dead_refresh_token' }
            }) as any;

            fetchSpy.mock.mockImplementation(async () => {
                return new Response(null, { status: 401 });
            });

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            assert.strictEqual(isRefreshed, false);
            assert.strictEqual((response as any).type, 'redirect');
            assert.ok((response as any).url.includes('/logout?error=session_expired'));
        });
    });

    // ==========================================
    // Suite 4: Smart HTTP Client / Silent Retry
    // ==========================================
    describe('Suite 4: Smart HTTP Client / Silent Retry', () => {
        it('4.1 should execute normal fetch and return data on 200 OK', async () => {
            mockCookies.set('access_tok', 'valid_access');

            fetchSpy.mock.mockImplementation(async () => {
                return new Response(JSON.stringify({ hello: 'world' }), { status: 200 });
            });

            const res = await service.protFetch('/api/hello');

            assert.strictEqual(res.status, 200);
            assert.strictEqual(fetchSpy.mock.callCount(), 1);
            const callArgs = fetchSpy.mock.calls[0].arguments;
            assert.strictEqual(callArgs[0], 'http://backend:4400/api/hello');
            const sentHeaders = (callArgs[1] as any).headers as Headers;
            assert.strictEqual(sentHeaders.get('Cookie'), 'access_tok=valid_access');
        });

        it('4.2 should retry fetch silently in Action context when 401 triggers and refresh succeeds', async () => {
            mockCookies.set('access_tok', 'expired_access');
            mockCookies.set('refresh_tok', 'good_refresh');

            let callCount = 0;
            fetchSpy.mock.mockImplementation(async (url) => {
                if (url.includes('/api/auth/refresh')) {
                    const headers = new Headers();
                    headers.append('Set-Cookie', 'access_tok=fresh_access; Path=/');
                    headers.append('Set-Cookie', 'refresh_tok=fresh_refresh; Path=/');
                    return new Response(null, { status: 200, headers });
                }

                callCount++;
                if (callCount === 1) {
                    return new Response(null, { status: 401 });
                }
                return new Response(JSON.stringify({ data: 'retried' }), { status: 200 });
            });

            const res = await service.protFetch('/api/action-url', { isAction: true, method: 'POST' });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(fetchSpy.mock.callCount(), 3);

            assert.strictEqual(mockCookies.get('access_tok')?.value, 'fresh_access');
            assert.strictEqual(mockCookies.get('refresh_tok')?.value, 'fresh_refresh');

            const retryCallHeaders = fetchSpy.mock.calls[2].arguments[1].headers as Headers;
            assert.strictEqual(retryCallHeaders.get('Cookie'), 'access_tok=fresh_access; refresh_tok=fresh_refresh');
        });

        it('4.3 should redirect to sign-out in Action context when 401 occurs and refresh fails', async () => {
            mockCookies.set('access_tok', 'expired_access');
            mockCookies.set('refresh_tok', 'bad_refresh');

            let callCount = 0;
            fetchSpy.mock.mockImplementation(async (url) => {
                if (url.includes('/api/auth/refresh')) {
                    return new Response(null, { status: 400 });
                }
                callCount++;
                if (callCount === 1) {
                    return new Response(null, { status: 401 });
                }
                return new Response(null, { status: 200 });
            });

            await assert.rejects(
                async () => { await service.protFetch('/api/action-url', { isAction: true }); },
                (err: Error) => err.message === 'REDIRECT_THROWN: /logout?error=session_expired'
            );

            assert.strictEqual(redirectSpy.mock.callCount(), 1);
            assert.strictEqual(redirectSpy.mock.calls[0].arguments[0], '/logout?error=session_expired');
        });

        it('4.4 should redirect to reanimator route in Server Component context (isAction: false) on 401', async () => {
            mockCookies.set('access_tok', 'expired_access');
            mockHeaders.set('x-url', 'http://localhost:3000/some-page');

            fetchSpy.mock.mockImplementation(async () => {
                return new Response(null, { status: 401 });
            });

            const expectedRedirectTarget = '/refresh-bounce?returnUrl=' + encodeURIComponent('http://localhost:3000/some-page');

            await assert.rejects(
                async () => { await service.protFetch('/api/data-url'); },
                (err: Error) => err.message === `REDIRECT_THROWN: ${expectedRedirectTarget}`
            );

            assert.strictEqual(redirectSpy.mock.callCount(), 1);
            assert.strictEqual(redirectSpy.mock.calls[0].arguments[0], expectedRedirectTarget);
        });

        it('4.5 should skip refresh and redirect immediately to sign-out in Action context on 401 if refresh token is missing', async () => {
            mockCookies.set('access_tok', 'expired_access');

            fetchSpy.mock.mockImplementation(async () => {
                return new Response(null, { status: 401 });
            });

            await assert.rejects(
                async () => { await service.protFetch('/api/action-url', { isAction: true }); },
                (err: Error) => err.message === 'REDIRECT_THROWN: /logout?error=session_expired'
            );

            assert.strictEqual(fetchSpy.mock.callCount(), 1);
            assert.strictEqual(redirectSpy.mock.callCount(), 1);
            assert.strictEqual(redirectSpy.mock.calls[0].arguments[0], '/logout?error=session_expired');
        });
    });

    // ==========================================
    // Suite 5: Reanimator Handler
    // ==========================================
    describe('Suite 5: Reanimator Handler', () => {
        it('5.1 should redirect back to returnUrl with cookie headers on successful refresh', async () => {
            mockCookies.set('refresh_tok', 'active_refresh');

            const req = new MockNextRequest('http://localhost:3000/api/auth/refresh-and-return?returnUrl=%2Fdashboard') as any;

            fetchSpy.mock.mockImplementation(async () => {
                const headers = new Headers();
                headers.append('Set-Cookie', 'access_tok=new_access; Path=/');
                headers.append('Set-Cookie', 'refresh_tok=new_refresh; Path=/');
                return new Response(null, { status: 200, headers });
            });

            const res = await service.handleRefreshAndReturn(req);

            assert.strictEqual((res as any).type, 'redirect');
            assert.strictEqual((res as any).url, 'http://localhost:3000/dashboard');

            const cookiesHeader = res.headers.get('Set-Cookie');
            assert.ok(cookiesHeader.includes('access_tok=new_access; Path=/'));
            assert.ok(cookiesHeader.includes('refresh_tok=new_refresh; Path=/'));
        });

        it('5.2 should redirect to sign-out if refresh fails inside reanimator', async () => {
            mockCookies.set('refresh_tok', 'dead_refresh');

            const req = new MockNextRequest('http://localhost:3000/api/auth/refresh-and-return?returnUrl=%2Fdashboard') as any;

            fetchSpy.mock.mockImplementation(async () => {
                return new Response(null, { status: 400 });
            });

            const res = await service.handleRefreshAndReturn(req);

            assert.strictEqual((res as any).type, 'redirect');
            assert.ok((res as any).url.includes('/logout?error=session_expired'));
        });

        it('5.3 should redirect to sign-out immediately if refresh token is missing in cookie store', async () => {
            const req = new MockNextRequest('http://localhost:3000/api/auth/refresh-and-return') as any;

            const res = await service.handleRefreshAndReturn(req);

            assert.strictEqual((res as any).type, 'redirect');
            assert.ok((res as any).url.includes('/logout?error=session_expired'));
            assert.strictEqual(fetchSpy.mock.callCount(), 0);
        });
    });
});
