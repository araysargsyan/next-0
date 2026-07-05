import { uploadImagesAction } from "@/app/(home)/actions";
import Formy from "@/components/UI/Formy";
import FormyError from "@/components/UI/Formy/FormyError";
import { FormySubmit, FormySuccess } from "@/components/UI/Formy";

export default function ImageUploadForm() {
    return (
        <div style={{ marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Upload Product</h3>
            <Formy
                id="image-upload-form"
                action={uploadImagesAction}
                clearOnSuccess={false}
                className="relative flex flex-col"
            >
                {/* Product Name Wrapper */}
                <div className="relative mb-6">
                    <label htmlFor="name" style={{ display: "block", marginBottom: "5px" }}>Product name:</label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        defaultValue="New product"
                        style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ddd" }}
                    />
                    <FormyError field="name" below />
                </div>

                {/* Price Wrapper */}
                <div className="relative mb-6">
                    <label htmlFor="price" style={{ display: "block", marginBottom: "5px" }}>Price:</label>
                    <input
                        id="price"
                        name="price"
                        type="number"
                        style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ddd" }}
                    />
                    <FormyError field="price" below />
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
                    <FormyError field="images" below />
                </div>

                {/* Relative Wrapper for Global Error and Submit Button */}
                <div className="relative">
                    <FormyError />
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
