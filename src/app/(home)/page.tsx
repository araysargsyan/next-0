import { protFetch } from "@/lib/auth";
import ImageUploadForm from "@/components/Forms/ImageUploadForm";
import { createLogger } from "@/lib/logger";
import Link from "next/link";
import SignOutLink from "@/components/SignOutLink";

const log = createLogger('HomePage', 'green');

export default async function Home() {
  log("[START]: Rendering home page");

  const res = await protFetch("/api/auth/me");
  let user: { name: string; [key: string]: unknown } | null = null;

  if (res.ok) {
    try {
      user = await res.json();
      log("[FINISH]: Profile loaded", { userName: user?.name });
    } catch {
      log("[ERROR]: Failed to parse user JSON");
    }
  } else {
    log("[ERROR]: Failed to load profile", { status: res.status });
  }

  return (
      <div style={{ padding: "20px" }}>
          <h1>Home (v1)</h1>
          
          {user ? (
              <p>Welcome, {user.name}!</p>
          ) : (
              <p style={{ color: "red" }}>Failed to load profile (backend is offline or unreachable).</p>
          )}

          {/* Render the upload form regardless of backend status */}
          <ImageUploadForm />

          {user && (
              <div style={{ marginTop: "40px" }}>
                <h3>Profile data:</h3>
                <pre>{JSON.stringify(user, null, 2)}</pre>
              </div>
          )}

          <div style={{ marginTop: "20px", display: "flex", gap: "15px" }}>
              <Link href="/about" prefetch={false} style={{ color: "#0070f3", textDecoration: "underline" }}>
                  About page
              </Link>
              <SignOutLink style={{ color: "red" }}>Sign out</SignOutLink>
          </div>
      </div>
  );
}
