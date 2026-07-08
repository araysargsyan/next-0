import { NextRequest } from "next/server";
import { AuthService } from "@/libs/auth";

/**
 * This route is the "reanimator" — it fully delegates its logic to AuthService.
 */
export async function GET(req: NextRequest) {
    return AuthService.handleRefreshAndReturn(req);
}
