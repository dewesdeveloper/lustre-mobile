/** Человекочитаемая ошибка запроса: статус + сообщение сервера. */
export function apiError(e: unknown, fallback = 'Ошибка сети'): string {
  const err = e as {
    response?: { status?: number; data?: { error?: string } };
    message?: string;
    code?: string;
  };
  const status = err?.response?.status;
  const msg = err?.response?.data?.error;
  if (msg) return status ? `${status}: ${msg}` : msg;
  if (status) return `HTTP ${status}`;
  return err?.message || fallback;
}
