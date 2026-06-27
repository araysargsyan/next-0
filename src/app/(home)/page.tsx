import {protFetch} from "@/lib";
import ImageUploadForm from "@/components/ImageUploadForm";
import { createLogger } from "@/lib/logger";

const log = createLogger('HomePage', 'green');

export default async function Home() {
  log("[START]: Rendering home page");

  const res = await protFetch("/api/auth/me");

  if (!res.ok) {
    log("[ERROR]: Failed to load profile", { status: res.status });
    return <div>Ошибка загрузки профиля</div>;
  }

  const user = await res.json();
  log("[FINISH]: Profile loaded", { userName: user.name });

  return (
      <div style={{ padding: "20px" }}>
          <h1>Главная (v1)</h1>
          <p>Добро пожаловать, {user.name}!</p>

          <ImageUploadForm />

          <div style={{ marginTop: "40px" }}>
            <h3>Данные профиля:</h3>
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>

          <a href="/api/auth/sign-out">Выйти</a>
      </div>
  );
}
