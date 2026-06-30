import {NextRequest, NextResponse} from "next/server";
import {AuthService} from "@/lib/auth";
import {createLogger} from "@/lib/logger";

const PUBLIC_ROUTES = ["/sign-in"];

const log = createLogger('Proxy', 'yellow');

export default async function proxy(req: NextRequest) {
    const {pathname} = req.nextUrl;
    const accessToken = req.cookies.get("accessToken")?.value;
    const refreshToken = req.cookies.get("refreshToken")?.value;

    log(`[START]: (${pathname})`, {hasAT: !!accessToken, hasRT: !!refreshToken});

    // 1. Публичные маршруты
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        if (pathname === '/sign-in' && refreshToken) {
            log(`[FINISH]: (${pathname}) ->`, 'Redirect to home (already authenticated)');
            return NextResponse.redirect(new URL("/", req.url));
        }
        log(`[FINISH]: (${pathname}) ->`, 'Public route access');
        return NextResponse.next();
    }

    // 2. Если нет вообще никаких токенов — на вход
    if (!refreshToken && !accessToken) {
        log(`[FINISH]: (${pathname}) ->`, 'No tokens, redirect to sign-in');
        return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // 3. ГЛОБАЛЬНАЯ МАГИЯ v4 (Proactive Refresh & Double Sync)
    const { response, isRefreshed } = await AuthService.getAuthorizedResponse(req);

    log(`[FINISH]: (${pathname}) ->`, { refreshed: isRefreshed });

    return response;
}


export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
