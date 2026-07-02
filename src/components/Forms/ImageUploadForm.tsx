"use client";

import { useState } from "react";
import { uploadImagesAction } from "@/app/(home)/actions";
import Formy from "./index";

export default function ImageUploadForm() {
    const [selectedFiles, setSelectedFiles] = useState<number>(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(e.target.files.length);
        }
    };

    return (
        <div style={{ marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Upload Product</h3>
            <Formy
                action={uploadImagesAction}
                className=""
            >
                {(state, isPending) => (
                    <>
                        <div style={{ marginBottom: "15px" }}>
                            <label htmlFor="name" style={{ display: "block", marginBottom: "5px" }}>Product name:</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                defaultValue="New product"
                                style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ddd" }}
                                disabled={isPending}
                            />
                        </div>

                        <div style={{ marginBottom: "15px" }}>
                            <label htmlFor="price" style={{ display: "block", marginBottom: "5px" }}>Price:</label>
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
                                Select images:
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

                        {selectedFiles > 0 && <p>Files selected: {selectedFiles}</p>}

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
                            {isPending ? "Uploading..." : "Submit"}
                        </button>

                        {state?.error && <p style={{ color: "red", marginTop: "10px" }}>{state.error}</p>}
                        {state?.success && <p style={{ color: "green", marginTop: "10px" }}>Images uploaded successfully!</p>}
                    </>
                )}
            </Formy>
        </div>
    );
}
