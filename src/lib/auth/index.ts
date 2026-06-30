import { AuthService as AuthServiceClass } from "./AuthService";
import { API_URL, COOKIE_NAMES } from "@/config";

export const AuthService = new AuthServiceClass({
    apiUrl: API_URL,
    cookieNames: COOKIE_NAMES,
});

export const protFetch = AuthService.protFetch;
