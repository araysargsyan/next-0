import { uploadImagesAction } from "@/app/(home)/actions";
import Formy, { FormySubmit, FormySuccess } from "@/libs/formy";
import { ProductNameSelect } from "./ProductNameSelect";
import { FieldError } from "./FieldError";

export default function ImageUploadForm() {
    /*
     * NOTE: This block of code is a template for the immediate upload pattern.
     * It is NOT ready for use because the backend API (/api/upload/temp) is not yet implemented.
     *
     * const [tempFileId, setTempFileId] = useState<string | null>(null);
     *
     * // Case 1: SPA navigation — useEffect cleanup
     * useEffect(() => {
     *     return () => {
     *         if (tempFileId) {
     *             fetch(`/api/upload/temp/${tempFileId}`, { method: "DELETE" }).catch(() => {});
     *         }
     *     };
     * }, [tempFileId]);
     *
     * // Case 2: Normal tab close — sendBeacon
     * useEffect(() => {
     *     const handlePageHide = () => {
     *         if (tempFileId) {
     *             navigator.sendBeacon(`/api/upload/temp/${tempFileId}/delete`);
     *         }
     *     };
     *     window.addEventListener("pagehide", handlePageHide);
     *     return () => window.removeEventListener("pagehide", handlePageHide);
     * }, [tempFileId]);
     *
     * const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     *     const file = e.target.files?.[0];
     *     if (!file) return;
     *
     *     try {
     *         const formData = new FormData();
     *         formData.append("file", file);
     *         const res = await fetch("/api/upload/temp", {
     *             method: "POST",
     *             body: formData,
     *         });
     *         const { tempId } = await res.json();
     *         setTempFileId(tempId);
     *     } catch (err) {
     *         console.error("Failed to upload temp file", err);
     *     }
     * };
     */

    return (
        <div style={{ marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Upload Product</h3>
            <Formy
                id="image-upload-form"
                action={uploadImagesAction}
                clearOnSuccess={false}
                className="relative flex flex-col"
            >
                {/* Product Name — custom select via useErrorsContext (Pattern I) */}
                <ProductNameSelect name="name" label="Product name:" />

                {/* Price Wrapper */}
                <div className="relative mb-6">
                    <label htmlFor="price" style={{ display: "block", marginBottom: "5px" }}>Price:</label>
                    <input
                        id="price"
                        name="price"
                        type="number"
                        style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ddd" }}
                    />
                    <FieldError field="price" />
                </div>

                {/* Images Wrapper */}
                <div className="relative mb-6">
                    <label htmlFor="images" style={{ display: "block", marginBottom: "5px" }}>
                        Select images:
                    </label>
                    <input
                        id="images"
                        name="images"
                        type="file"
                        multiple
                        accept="image/*"
                        required
                    />
                    <FieldError field="images" />
                </div>

                {/* Relative Wrapper for Global Error and Submit Button */}
                <div className="relative">
                    <FieldError above={true} />
                    <FormySubmit
                        loadingLabel="Uploading..."
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#0070f3",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            width: "100%"
                        }}
                    >
                        Submit
                    </FormySubmit>
                </div>

                {/* Success Banner */}
                <FormySuccess>
                    <p style={{ color: "green", marginTop: "10px" }}>Images uploaded successfully!</p>
                </FormySuccess>
            </Formy>
        </div>
    );
}

