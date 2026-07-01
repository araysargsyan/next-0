import {protFetch} from "@/lib/auth";
import ImageUploadForm from "@/components/Forms/ImageUploadForm";
import { createLogger } from "@/lib/logger";
import Link from "next/link";
import SignOutLink from "@/components/SignOutLink";

const log = createLogger('HomePage', 'green');

export default async function Home() {
  log("[START]: Rendering home page");

  // Artificial delay to test loading state
  await new Promise(resolve => setTimeout(resolve, 2000));

  const res = await protFetch("/api/auth/me");

  if (!res.ok) {
    log("[ERROR]: Failed to load profile", { status: res.status });
      return <div>
          <h1>Home</h1>
          <div>Failed to load profile</div>
      </div>;
  }

  const user = await res.json();
  log("[FINISH]: Profile loaded", { userName: user.name });

  return (
      <div style={{ padding: "20px" }}>
          <h1>Home (v1)</h1>
          <p>Welcome, {user.name}!</p>

          <ImageUploadForm />

          <div style={{ marginTop: "40px" }}>
            <h3>Profile data:</h3>
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>

          <div style={{ marginTop: "20px", display: "flex", gap: "15px" }}>
              <Link href="/about" prefetch={false} style={{ color: "#0070f3", textDecoration: "underline" }}>
                  About page
              </Link>
              <SignOutLink style={{ color: "red" }}>Sign out</SignOutLink>
          </div>
      </div>
  );
}
