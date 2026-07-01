import {protFetch} from "@/lib/auth";
import ImageUploadForm from "@/components/Forms/ImageUploadForm";
import { createLogger } from "@/lib/logger";
import SignOutLink from "@/components/SignOutLink";

const log = createLogger('HomePage', 'green');

export default async function About() {
  log("[START]: Rendering home page");

  const res = await protFetch("/api/auth/me");

  if (!res.ok) {
    log("[ERROR]: Failed to load profile", { status: res.status });
    return <div>
        <h1>About</h1>
        <div>Failed to load profile</div>
    </div>;
  }

  const user = await res.json();
  log("[FINISH]: Profile loaded", { userName: user.name });

  return (
      <div style={{ padding: "20px" }}>
          <h1>About</h1>
          <p>Welcome, {user.name}!</p>

          <ImageUploadForm />

          <div style={{ marginTop: "40px" }}>
            <h3>Profile data:</h3>
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>

          <SignOutLink style={{ color: "red" }}>Sign out</SignOutLink>
      </div>
  );
}
