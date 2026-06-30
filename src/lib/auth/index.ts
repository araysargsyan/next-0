import { AuthService as AuthServiceClass } from "./AuthService";
import { API_URL, COOKIE_NAMES, AUTH_ROUTES } from "@/config";

export const AuthService = new AuthServiceClass({
    apiUrl: API_URL,
    cookieNames: COOKIE_NAMES,
    routes: AUTH_ROUTES,
});

export const protFetch = AuthService.protFetch;
