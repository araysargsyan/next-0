"use server";

import { protFetch } from "@/libs/auth";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/libs/utils/logger";
import { parseApiError } from "@/helpers/parseApiError";
import {FormyActionState} from "@/libs/formy";

const log = createLogger('UploadAction', 'magenta');

export async function uploadImagesAction(_prevState: unknown, formData: FormData): Promise<FormyActionState> {
    const name = formData.get("name") as string;
    log(`[START]: (${name || 'unknown'})`, "Processing image upload...");

    // Extract all form data
    const files = formData.getAll("images");
    const price = formData.get("price") as string;

    if (!files || files.length === 0) {
        log(`[ERROR]: (${name || 'unknown'}) ->`, "No files selected");
        return { error: "No files selected" };
    }

    // Build a new FormData object specifically for the backend upload
    const formDataToUpload = new FormData();

    // Append string fields
    formDataToUpload.append("name", name);
    formDataToUpload.append("price", price);
    // Append files
    files.forEach((file) => {
        formDataToUpload.append("images", file);
    });

    try {
        const res = await protFetch("/api/product", {
            method: "POST",
            body: formDataToUpload,
            isAction: true,
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            log(`[ERROR]: (${name || 'unknown'}) ->`, "Upload failed", { status: res.status, errorData });

            const errorMessage = parseApiError(errorData);
            return { error: errorMessage };
        }

        const apiResponseData = await res.json();
        log(`[FINISH]: (${name || 'unknown'}) ->`, "Upload successful", { data: apiResponseData });

        revalidatePath("/"); // Revalidate the page to reflect the new upload
        return { data: apiResponseData };
    } catch (e) {
        log(`[ERROR]: (${name || 'unknown'}) ->`, "Critical failure", String(e));
        return { error: "Something went wrong. Please try again later." };
    }
}
