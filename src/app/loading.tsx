export default function GlobalLoading() {
    return (
        <div style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            zIndex: 9999
        }}>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
            <span style={{ marginLeft: "10px", fontFamily: "sans-serif" }}>Loading...</span>
        </div>
    );
}
