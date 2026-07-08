import { AuthService } from '../AuthService';
import { NextRequest } from 'next/server';

// ==========================================
// 1. Mocking next/server (defined inside the mock to avoid hoisting ReferenceError)
// ==========================================
jest.mock('next/server', () => {
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

    return {
        NextRequest: MockNextRequest,
        NextResponse: MockNextResponse,
    };
});

// ==========================================
// 2. Mocking next/headers and next/navigation
// ==========================================

const mockCookies = {
    get: jest.fn(),
    set: jest.fn(),
    toString: jest.fn(),
};

const mockHeaders = {
    get: jest.fn(),
};

jest.mock('next/headers', () => ({
    cookies: jest.fn(() => Promise.resolve(mockCookies)),
    headers: jest.fn(() => Promise.resolve(mockHeaders)),
}));

const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
    redirect: jest.fn((url: string) => {
        mockRedirect(url);
        throw new Error(`REDIRECT_THROWN: ${url}`);
    }),
}));

// ==========================================
// 3. Test Suites
// ==========================================

describe('AuthService', () => {
    let service: AuthService;
    let fetchSpy: jest.Mock;

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

    beforeAll(() => {
        // Redirect console.log to process.stdout.write with a 4-space indentation
        // to clearly group logs under their respective test headers
        jest.spyOn(console, 'log').mockImplementation((...args) => {
            const formatted = args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return '[Object]';
                    }
                }
                return String(arg);
            }).join(' ');
            process.stdout.write('    ' + formatted + '\n');
        });
    });

    const getCleanTestName = (name: string) => {
        // Extracts only the test number (e.g. "5.3") from the full Jest test name
        const match = name.match(/(\d+\.\d+)/);
        return match ? match[1] : name;
    };

    beforeEach(() => {
        const testName = getCleanTestName(expect.getState().currentTestName || '');
        process.stdout.write(`\n[START] >>> ${testName}\n`);

        jest.clearAllMocks();
        mockCookies.get.mockReset();
        mockCookies.set.mockReset();
        mockCookies.toString.mockReset();
        mockHeaders.get.mockReset();
        mockRedirect.mockReset();

        service = new AuthService(mockConfig);

        fetchSpy = jest.fn();
        global.fetch = fetchSpy;
    });

    afterEach(() => {
        const testName = getCleanTestName(expect.getState().currentTestName || '');
        process.stdout.write(`[END]   <<< ${testName}\n`);
    });

    // ==========================================
    // 1. Cookie Parser & Commit
    // ==========================================
    describe('1. Cookie Parser & Commit', () => {
        it('1.1 should parse standard cookie headers with full attributes', () => {
            const setCookieHeader = 'session_id=12345abc; Domain=backend.com; Path=/api; Max-Age=3600; HttpOnly; Secure; SameSite=Lax; Priority=High; Partitioned';
            const parsed = service.parseSetCookie(setCookieHeader);

            expect(parsed).toBeDefined();
            expect(parsed?.name).toBe('session_id');
            expect(parsed?.value).toBe('12345abc');
            expect(parsed?.domain).toBe('backend.com');
            expect(parsed?.path).toBe('/api');
            expect(parsed?.maxAge).toBe(3600);
            expect(parsed?.httpOnly).toBe(true);
            expect(parsed?.secure).toBe(true);
            expect(parsed?.sameSite).toBe('lax');
            expect(parsed?.priority).toBe('high');
            expect(parsed?.partitioned).toBe(true);
        });

        it('1.2 should parse empty cookie values and keep them (empty value fix)', () => {
            const deleteCookieHeader = 'access_tok=; Path=/; Max-Age=0; HttpOnly; Secure';
            const parsed = service.parseSetCookie(deleteCookieHeader);

            expect(parsed).toBeDefined();
            expect(parsed?.name).toBe('access_tok');
            expect(parsed?.value).toBe('');
            expect(parsed?.maxAge).toBe(0);
            expect(parsed?.path).toBe('/');
        });

        it('1.3 should normalize SameSite and priority casing values', () => {
            const rawHeader = 'tok=abc; SameSite=STRICT; Priority=MEDIUM';
            const parsed = service.parseSetCookie(rawHeader);

            expect(parsed?.sameSite).toBe('strict');
            expect(parsed?.priority).toBe('medium');
        });

        it('1.4 should write parsed cookies correctly into cookieStore via commitCookies', async () => {
            const rawCookies = [
                'access_tok=new_access; Path=/; HttpOnly',
                'refresh_tok=new_refresh; Path=/; HttpOnly; Secure'
            ];

            await service.commitCookies(rawCookies);

            expect(mockCookies.set).toHaveBeenCalledTimes(2);
            expect(mockCookies.set).toHaveBeenNthCalledWith(1, 'access_tok', 'new_access', { path: '/', httpOnly: true });
            expect(mockCookies.set).toHaveBeenNthCalledWith(2, 'refresh_tok', 'new_refresh', { path: '/', httpOnly: true, secure: true });
        });
    });

    // ==========================================
    // 2. Low-Level Token Refresh
    // ==========================================
    describe('2. Low-Level Token Refresh', () => {
        it('2.1 should return success, parsed cookies and raw list on backend 200 OK', async () => {
            fetchSpy.mockResolvedValue(
                new Response(null, {
                    status: 200,
                    headers: new Headers([
                        ['Set-Cookie', 'access_tok=token123; Path=/'],
                        ['Set-Cookie', 'refresh_tok=token456; Path=/']
                    ])
                })
            );

            const result = await service.refresh('old_refresh_token', '/dashboard');

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const callArgs = fetchSpy.mock.calls[0];
            expect(callArgs[0]).toBe('http://backend:4400/api/auth/refresh');
            expect(callArgs[1].headers.Cookie).toBe('refresh_tok=old_refresh_token');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.cookieString).toBe('access_tok=token123; refresh_tok=token456');
                expect(result.rawSetCookies.length).toBe(2);
            }
        });

        it('2.2 should return failure if backend returns 200 but no Set-Cookie headers', async () => {
            fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

            const result = await service.refresh('old_refresh', '/dashboard');

            expect(result.success).toBe(false);
        });

        it('2.3 should return failure if backend rejects refresh (e.g., 401)', async () => {
            fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));

            const result = await service.refresh('invalid_refresh', '/dashboard');

            expect(result.success).toBe(false);
        });

        it('2.4 should return failure and handle timeout abort cleanly', async () => {
            fetchSpy.mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

            const result = await service.refresh('refresh_token', '/dashboard');

            expect(result.success).toBe(false);
        });
    });

    // ==========================================
    // 3. Middleware Gateway
    // ==========================================
    describe('3. Middleware Gateway', () => {
        it('3.1 should return NextResponse.next() unmodified if access token is present', async () => {
            const req = new NextRequest('http://localhost:3000/dashboard', {
                headers: { Cookie: 'access_tok=existing_access' }
            }) as any;

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            expect(isRefreshed).toBe(false);
            expect((response as any).type).toBe('next');
            expect((response as any).requestHeaders).toBeDefined();
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('3.2 should return NextResponse.next() unmodified if both tokens are missing', async () => {
            const req = new NextRequest('http://localhost:3000/dashboard') as any;

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            expect(isRefreshed).toBe(false);
            expect((response as any).type).toBe('next');
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('3.3 should perform Double Sync when access token is missing but refresh token exists', async () => {
            const req = new NextRequest('http://localhost:3000/profile', {
                headers: { Cookie: 'refresh_tok=active_refresh_token' }
            }) as any;

            fetchSpy.mockResolvedValue(
                new Response(null, {
                    status: 200,
                    headers: new Headers([
                        ['Set-Cookie', 'access_tok=new_access; Path=/'],
                        ['Set-Cookie', 'refresh_tok=new_refresh; Path=/']
                    ])
                })
            );

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            expect(isRefreshed).toBe(true);
            expect((response as any).type).toBe('next');

            const requestHeaders = (response as any).requestHeaders;
            expect(requestHeaders!.get('Cookie')).toBe('access_tok=new_access; refresh_tok=new_refresh');

            const responseCookies = response.headers.get('Set-Cookie');
            expect(responseCookies!.includes('access_tok=new_access; Path=/')).toBe(true);
            expect(responseCookies!.includes('refresh_tok=new_refresh; Path=/')).toBe(true);
        });

        it('3.4 should return sign-out redirect response if refresh token is expired/rejected in middleware', async () => {
            const req = new NextRequest('http://localhost:3000/dashboard', {
                headers: { Cookie: 'refresh_tok=dead_refresh_token' }
            }) as any;

            fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));

            const { response, isRefreshed } = await service.getAuthorizedResponse(req);

            expect(isRefreshed).toBe(false);
            expect((response as any).type).toBe('redirect');
            expect((response as any).url.includes('/logout?error=session_expired')).toBe(true);
        });

        it('3.5 should inject x-url header into request headers in getAuthorizedResponse', async () => {
            const req = new NextRequest('http://localhost:3000/some-dashboard-page') as any;
            const { response } = await service.getAuthorizedResponse(req);

            const requestHeaders = (response as any).requestHeaders;
            expect(requestHeaders).toBeDefined();
            expect(requestHeaders.get('x-url')).toBe('http://localhost:3000/some-dashboard-page');
        });
    });

    // ==========================================
    // 4. Smart HTTP Client / Silent Retry
    // ==========================================
    describe('4. Smart HTTP Client / Silent Retry', () => {
        it('4.1 should execute normal fetch and return data on 200 OK', async () => {
            mockCookies.get.mockReturnValue({ value: 'valid_access' });
            mockCookies.toString.mockReturnValue('access_tok=valid_access');

            fetchSpy.mockResolvedValue(new Response(JSON.stringify({ hello: 'world' }), { status: 200 }));

            const res = await service.protFetch('/api/hello');

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const callArgs = fetchSpy.mock.calls[0];
            expect(callArgs[0]).toBe('http://backend:4400/api/hello');
            const sentHeaders = callArgs[1].headers as Headers;
            expect(sentHeaders.get('Cookie')).toBe('access_tok=valid_access');
        });

        it('4.2 should retry fetch silently in Action context when 401 triggers and refresh succeeds', async () => {
            mockCookies.get.mockImplementation((name: string) => {
                if (name === 'access_tok') return { value: 'expired_access' };
                if (name === 'refresh_tok') return { value: 'good_refresh' };
                return undefined;
            });
            mockCookies.toString.mockReturnValue('access_tok=expired_access; refresh_tok=good_refresh');

            let callCount = 0;
            fetchSpy.mockImplementation(async (url: any) => {
                if (String(url).includes('/api/auth/refresh')) {
                    return new Response(null, {
                        status: 200,
                        headers: new Headers([
                            ['Set-Cookie', 'access_tok=fresh_access; Path=/'],
                            ['Set-Cookie', 'refresh_tok=fresh_refresh; Path=/']
                        ])
                    });
                }

                callCount++;
                if (callCount === 1) {
                    return new Response(null, { status: 401 });
                }
                return new Response(JSON.stringify({ data: 'retried' }), { status: 200 });
            });

            const res = await service.protFetch('/api/action-url', { isAction: true, method: 'POST' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledTimes(3);

            expect(mockCookies.set).toHaveBeenCalledTimes(2);
            expect(mockCookies.set).toHaveBeenNthCalledWith(1, 'access_tok', 'fresh_access', { path: '/' });
            expect(mockCookies.set).toHaveBeenNthCalledWith(2, 'refresh_tok', 'fresh_refresh', { path: '/' });
        });

        it('4.3 should redirect to sign-out in Action context when 401 occurs and refresh fails', async () => {
            mockCookies.get.mockImplementation((name: string) => {
                if (name === 'access_tok') return { value: 'expired_access' };
                if (name === 'refresh_tok') return { value: 'bad_refresh' };
                return undefined;
            });

            let callCount = 0;
            fetchSpy.mockImplementation(async (url: any) => {
                if (String(url).includes('/api/auth/refresh')) {
                    return new Response(null, { status: 400 });
                }
                callCount++;
                if (callCount === 1) {
                    return new Response(null, { status: 401 });
                }
                return new Response(null, { status: 200 });
            });

            await expect(
                service.protFetch('/api/action-url', { isAction: true })
            ).rejects.toThrow('REDIRECT_THROWN: /logout?error=session_expired');

            expect(mockRedirect).toHaveBeenCalledWith('/logout?error=session_expired');
        });

        it('4.4 should redirect to reanimator route in Server Component context (isAction: false) on 401', async () => {
            mockCookies.get.mockReturnValue({ value: 'expired_access' });
            mockHeaders.get.mockReturnValue('http://localhost:3000/some-page');

            fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));

            const expectedRedirectTarget = '/refresh-bounce?returnUrl=' + encodeURIComponent('http://localhost:3000/some-page');

            await expect(
                service.protFetch('/api/data-url')
            ).rejects.toThrow(`REDIRECT_THROWN: ${expectedRedirectTarget}`);

            expect(mockRedirect).toHaveBeenCalledWith(expectedRedirectTarget);
        });

        it('4.5 should skip refresh and redirect immediately to sign-out in Action context on 401 if refresh token is missing', async () => {
            mockCookies.get.mockReturnValue(undefined);

            fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));

            await expect(
                service.protFetch('/api/action-url', { isAction: true })
            ).rejects.toThrow('REDIRECT_THROWN: /logout?error=session_expired');

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(mockRedirect).toHaveBeenCalledWith('/logout?error=session_expired');
        });
    });

    // ==========================================
    // 5. Reanimator Handler
    // ==========================================
    describe('5. Reanimator Handler', () => {
        it('5.1 should redirect back to returnUrl with cookie headers on successful refresh', async () => {
            mockCookies.get.mockReturnValue({ value: 'active_refresh' });

            const req = new NextRequest('http://localhost:3000/api/auth/refresh-and-return?returnUrl=%2Fdashboard') as any;

            fetchSpy.mockResolvedValue(
                new Response(null, {
                    status: 200,
                    headers: new Headers([
                        ['Set-Cookie', 'access_tok=new_access; Path=/'],
                        ['Set-Cookie', 'refresh_tok=new_refresh; Path=/']
                    ])
                })
            );

            const res = await service.handleRefreshAndReturn(req);

            expect((res as any).type).toBe('redirect');
            expect((res as any).url).toBe('http://localhost:3000/dashboard');

            const cookiesHeader = res.headers.get('Set-Cookie');
            expect(cookiesHeader!.includes('access_tok=new_access; Path=/')).toBe(true);
            expect(cookiesHeader!.includes('refresh_tok=new_refresh; Path=/')).toBe(true);
        });

        it('5.2 should redirect to sign-out if refresh fails inside reanimator', async () => {
            mockCookies.get.mockReturnValue({ value: 'dead_refresh' });

            const req = new NextRequest('http://localhost:3000/api/auth/refresh-and-return?returnUrl=%2Fdashboard') as any;

            fetchSpy.mockResolvedValue(new Response(null, { status: 400 }));

            const res = await service.handleRefreshAndReturn(req);

            expect((res as any).type).toBe('redirect');
            expect((res as any).url.includes('/logout?error=session_expired')).toBe(true);
        });

        it('5.3 should redirect to sign-out immediately if refresh token is missing in cookie store', async () => {
            mockCookies.get.mockReturnValue(undefined);

            const req = new NextRequest('http://localhost:3000/api/auth/refresh-and-return?returnUrl=%2Fdashboard') as any;

            const res = await service.handleRefreshAndReturn(req);

            expect((res as any).type).toBe('redirect');
            expect((res as any).url.includes('/logout?error=session_expired')).toBe(true);
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });
});
