import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {createLogger} from "@/lib/logger";
import {COOKIE_NAMES} from "@/config";

const log = createLogger('SignOut', 'red');

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const error = searchParams.get("error");
    
    log(`[START]: (${error || 'manual'})`, "Signing out");
    
    const cookieStore = await cookies();

    // 1. Clear the session
    cookieStore.delete(COOKIE_NAMES.accessToken);
    cookieStore.delete(COOKIE_NAMES.refreshToken);

    // 2. Build the sign-in redirect URL
    const signInUrl = new URL("/sign-in", req.url);
    if (error) {
        signInUrl.searchParams.set("error", error);
    }

    log(`[FINISH]: (${error || 'manual'}) ->`, "Session cleared, forwarding to sign-in");
    return NextResponse.redirect(signInUrl);
}
