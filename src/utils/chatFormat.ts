import type { ChatMessage } from '@/api/chat';

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
}

export function formatDuration(total: number): string {
  const sec = Math.max(0, Math.floor(total));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Превью последнего сообщения для списка чатов (как в десктопе). */
export function dmPreview(m: ChatMessage, myId: number): string {
  const prefix = m.sender_id === myId ? 'Вы: ' : '';
  if (m.kind === 'call') {
    const outgoing = m.sender_id === myId;
    switch (m.call_status) {
      case 'missed':
        return prefix + (outgoing ? 'Нет ответа' : 'Пропущенный звонок');
      case 'canceled':
        return prefix + 'Отменённый звонок';
      case 'declined':
        return prefix + (outgoing ? 'Отклонён' : 'Отклонённый звонок');
      default:
        return prefix + 'Звонок';
    }
  }
  if (m.kind === 'image') return prefix + 'Изображение';
  if (m.kind === 'video') return prefix + 'Видео';
  if (m.kind === 'file') return prefix + (m.attachment_name || 'Файл');
  return prefix + (m.content || '');
}

export function callTitle(status: string, outgoing: boolean): string {
  switch (status) {
    case 'canceled':
      return 'Отменённый звонок';
    case 'missed':
      return outgoing ? 'Нет ответа' : 'Пропущенный звонок';
    case 'declined':
      return outgoing ? 'Отклонён' : 'Отклонённый звонок';
    case 'ended':
      return outgoing ? 'Исходящий звонок' : 'Входящий звонок';
    default:
      return 'Звонок';
  }
}

export function callSubLabel(status: string): string {
  switch (status) {
    case 'missed':
      return 'Не отвечено';
    case 'canceled':
      return 'Отменён';
    case 'declined':
      return 'Отклонён';
    default:
      return '';
  }
}
