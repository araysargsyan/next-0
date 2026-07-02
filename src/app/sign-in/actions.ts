"use server";

import {API_URL} from "@/config";
import {AuthService} from "@/lib/auth";
import {createLogger} from "@/lib/logger";

const log = createLogger('SignInAction', 'magenta');

export async function signInAction(_: unknown, formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    log(`[START]: (${email})`, { email });

    try {
        const res = await fetch(`${API_URL}/api/auth/sign-in`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email, password}),
        });

        if (!res.ok) {
            log(`[ERROR]: (${email}) ->`, "Invalid credentials or backend error", { status: res.status });
            return { success: false, error: "Invalid email or password" };
        }

        const headerCookies = res.headers.getSetCookie();
        if (headerCookies.length > 0) {
            log(`[AUTH]: (${email}) ->`, "Committing session cookies");
            await AuthService.commitCookies(headerCookies);
        }

        log(`[FINISH]: (${email}) ->`, "Success");
        return { success: true };
    } catch (e) {
        log(`[ERROR]: (${email}) ->`, "Critical failure", String(e));
        return { success: false, error: "Internal server error" };
    }
}
