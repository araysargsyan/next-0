"use server";

import { protFetch } from "@/lib/AuthService";
import { revalidatePath } from "next/cache";

import { createLogger } from "@/lib/logger";

const log = createLogger('UploadAction', 'magenta');

export async function uploadImagesAction(prevState: any, formData: FormData) {
    const name = formData.get("name") as string;
    log(`[START]: (${name || 'unknown'})`, "Processing image upload...");

    // Получаем все данные из формы
    const files = formData.getAll("images");
    const price = formData.get("price") as string;

    if (!files || files.length === 0) {
        log(`[ERROR]: (${name || 'unknown'}) ->`, "No files selected");
        return { error: "Файлы не выбраны" };
    }

    // Создаем новый объект FormData специально для отправки на бэкенд
    const formDataToUpload = new FormData();

    // Добавляем строковые поля
    formDataToUpload.append("name", name || "Default Name");
    formDataToUpload.append("price", price || "0");

    // Добавляем файлы
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
            return { error: "Ошибка при загрузке изображений на сервер" };
        }

        const apiResponseData = await res.json();
        log(`[FINISH]: (${name || 'unknown'}) ->`, "Upload successful", { data: apiResponseData });

        revalidatePath("/"); // Обновляем страницу, чтобы увидеть результат
        return { success: true, data: apiResponseData };
    } catch (e: any) {
        if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;

        log(`[ERROR]: (${name || 'unknown'}) ->`, "Critical failure", String(e));
        return { error: "Внутренняя ошибка сервера" };
    }
}
