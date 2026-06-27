import { AuthService as AuthServiceClass } from "./AuthService";
import { API_URL, BASE_URL } from "@/config";

// Инициализация синглтон-инстанса для использования в приложении
export const AuthService = new AuthServiceClass({
    apiUrl: API_URL,
    baseUrl: BASE_URL,
});

// Экспортируем забинженный хелпер protFetch для удобного импорта
export const protFetch = AuthService.protFetch.bind(AuthService);

// Экспорт типов для разработчиков
export type { ParsedCookie, AuthSDKConfig, AuthDependencies, TRefreshResponse } from "./AuthService";
export { AuthServiceClass };
