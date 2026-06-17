import { NextRequest } from "next/server";
import { AuthService } from "@/lib/AuthService";

/**
 * Этот роут — "реаниматор". 
 * Теперь он полностью делегирует логику в AuthService.
 */
export async function GET(req: NextRequest) {
    return AuthService.handleRefreshAndReturn(req);
}
