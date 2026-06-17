"use client";

import { useActionState, useState } from "react";
import { uploadImagesAction } from "../app/(home)/actions";

export default function ImageUploadForm() {
    const [state, action, isPending] = useActionState(uploadImagesAction, null);
    const [selectedFiles, setSelectedFiles] = useState<number>(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(e.target.files.length);
        }
    };

    return (
        <div style={{ marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Загрузка продукта</h3>
            <form action={action}>
                <div style={{ marginBottom: "15px" }}>
                    <label htmlFor="name" style={{ display: "block", marginBottom: "5px" }}>Название продукта:</label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        defaultValue="Новый товар"
                        style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ddd" }}
                        disabled={isPending}
                    />
                </div>

                <div style={{ marginBottom: "15px" }}>
                    <label htmlFor="price" style={{ display: "block", marginBottom: "5px" }}>Цена:</label>
                    <input
                        id="price"
                        name="price"
                        type="number"
                        defaultValue="1000"
                        style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ddd" }}
                        disabled={isPending}
                    />
                </div>

                <div style={{ marginBottom: "10px" }}>
                    <label htmlFor="images" style={{ display: "block", marginBottom: "5px" }}>
                        Выберите изображения:
                    </label>
                    <input
                        id="images"
                        name="images"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isPending}
                    />
                </div>

                {selectedFiles > 0 && <p>Выбрано файлов: {selectedFiles}</p>}

                <button
                    type="submit"
                    disabled={isPending || selectedFiles === 0}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: isPending ? "#ccc" : "#0070f3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isPending ? "not-allowed" : "pointer"
                    }}
                >
                    {isPending ? "Загрузка..." : "Отправить"}
                </button>
            </form>

            {state?.error && <p style={{ color: "red", marginTop: "10px" }}>{state.error}</p>}
            {state?.success && <p style={{ color: "green", marginTop: "10px" }}>Изображения успешно загружены!</p>}
        </div>
    );
}
