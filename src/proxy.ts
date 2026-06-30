import {NextRequest, NextResponse} from "next/server";
import {AuthService} from "@/lib/auth";
import {COOKIE_NAMES, PUBLIC_ROUTES} from "@/config";
import {createLogger} from "@/lib/logger";

const log = createLogger('Proxy', 'yellow');

export default async function proxy(req: NextRequest) {
    const {pathname} = req.nextUrl;
    const accessToken = req.cookies.get(COOKIE_NAMES.accessToken)?.value;
    const refreshToken = req.cookies.get(COOKIE_NAMES.refreshToken)?.value;

    log(`[START]: (${pathname})`, {hasAT: !!accessToken, hasRT: !!refreshToken});

    // 1. Public routes
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        if (pathname === '/sign-in' && refreshToken) {
            log(`[FINISH]: (${pathname}) ->`, 'Redirect to home (already authenticated)');
            return NextResponse.redirect(new URL("/", req.url));
        }
        log(`[FINISH]: (${pathname}) ->`, 'Public route access');
        return NextResponse.next();
    }

    // 2. If no tokens are present — redirect to sign-in
    if (!refreshToken && !accessToken) {
        log(`[FINISH]: (${pathname}) ->`, 'No tokens, redirect to sign-in');
        return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // 3. GLOBAL MAGIC v4 (Proactive Refresh & Double Sync)
    const { response, isRefreshed } = await AuthService.getAuthorizedResponse(req);

    log(`[FINISH]: (${pathname}) ->`, { refreshed: isRefreshed });

    return response;
}


export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
