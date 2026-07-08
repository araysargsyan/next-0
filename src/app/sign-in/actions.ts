"use server";

import { API_URL } from "@/config";
import { AuthService } from "@/libs/auth";
import { createLogger } from "@/libs/utils/logger";
import { parseApiError, ParsedApiError } from "@/helpers/parseApiError";
import {FormyActionState} from "@/libs/formy";

const log = createLogger('SignInAction', 'magenta');

export async function signInAction(_prevState: unknown, formData: FormData): Promise<FormyActionState> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    log(`[START]: (${email})`, { email });

    try {
        const res = await fetch(`${API_URL}/api/auth/sign-in`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            log(`[ERROR]: (${email}) ->`, "Invalid credentials or backend error", { status: res.status });

            let errorMessage: ParsedApiError = "Something went wrong. Please try again later.";
            try {
                const errBody = await res.json();
                errorMessage = parseApiError(errBody);
            } catch {
                // Ignore JSON parsing errors
            }

            return { error: errorMessage };
        }

        const headerCookies = res.headers.getSetCookie();
        if (headerCookies.length > 0) {
            log(`[AUTH]: (${email}) ->`, "Committing session cookies");
            await AuthService.commitCookies(headerCookies);
        }

        log(`[FINISH]: (${email}) ->`, "Success");
        return { data: null };
    } catch (e) {
        log(`[ERROR]: (${email}) ->`, "Critical failure", String(e));
        return { error: "Something went wrong. Please try again later." };
    }
}
