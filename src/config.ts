export const API_URL = process.env.NEXT_API_URL || "http://localhost:4400";

export const COOKIE_NAMES = {
    accessToken: "accessToken",
    refreshToken: "refreshToken",
} as const;

export const AUTH_ROUTES = {
    signOut: "/api/auth/sign-out",
    refreshAndReturn: "/api/auth/refresh-and-return",
} as const;

export const PUBLIC_ROUTES = [
    "/sign-in"
] as const;
