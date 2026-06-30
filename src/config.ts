export const API_URL = process.env.NEXT_API_URL || "http://localhost:4400";
export const COOKIE_NAMES = {
    accessToken: "accessToken",
    refreshToken: "refreshToken",
} as const;
