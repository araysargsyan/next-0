import { AuthService as AuthServiceClass } from "./AuthService";
import { API_URL, BASE_URL } from "@/config";

export const AuthService = new AuthServiceClass({
    apiUrl: API_URL,
    baseUrl: BASE_URL,
});

export const protFetch = AuthService.protFetch;

