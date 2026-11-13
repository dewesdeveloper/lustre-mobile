// Адрес бэкенда вшивается при сборке через EXPO_PUBLIC_API_URL (см. .env).
// Пользователь его не задаёт. localhost — только для локальной разработки.
const ENV_API = process.env.EXPO_PUBLIC_API_URL;

export const API_URL: string = (ENV_API || 'http://localhost:8080').replace(/\/+$/, '');

/** WebSocket чата — тот же хост, что и API. */
export const WS_CHAT_URL: string = `${API_URL.replace(/^http/, 'ws')}/ws/chat`;
