import { Linking } from 'react-native';

// Открываем во внешнем приложении только безопасные схемы. Ссылка-«вложение»
// или «источник» из чужого сообщения/игры могла бы иметь кастомную схему,
// intent:// или file:// и запустить другое приложение либо обратиться к
// локальному файлу — такие ссылки молча игнорируем.
const ALLOWED = /^(https?|mailto|tel):/i;

export function openExternalUrl(url: string | null | undefined): void {
  const u = (url || '').trim();
  if (!ALLOWED.test(u)) return;
  void Linking.openURL(u).catch(() => {});
}
