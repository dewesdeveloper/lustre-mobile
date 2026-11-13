import type { TicketStatus } from '@/api/support';

/** Цвета статусов — как STATUS_META на десктопе. */
export const STATUS_META: Record<TicketStatus, { label: string; color: string; bg: string; border: string }> = {
  open: { label: 'Открыт', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.45)' },
  in_progress: { label: 'В работе', color: '#FFB020', bg: 'rgba(255,176,32,0.12)', border: 'rgba(255,176,32,0.45)' },
  resolved: { label: 'Решён', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.45)' },
  closed: { label: 'Закрыт', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.35)' },
};

export const CATEGORY_LABEL: Record<string, string> = {
  bug: 'Проблема с запуском игры',
  payment: 'Ошибка оплаты или магазина',
  account: 'Аккаунт и безопасность',
  other: 'Другое',
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
};

/** Темы обращений — идентичны десктопному TicketForm. */
export const TOPICS: { label: string; category: string }[] = [
  { label: 'Проблема с запуском игры', category: 'bug' },
  { label: 'Ошибка оплаты или магазина', category: 'payment' },
  { label: 'Аккаунт и безопасность', category: 'account' },
  { label: 'Сообщества и контент', category: 'other' },
  { label: 'Предложение или идея', category: 'other' },
  { label: 'Другое', category: 'other' },
];

/** Частые вопросы по категориям (для хаба поддержки). */
export const FAQ: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'Аккаунт',
    items: [
      {
        q: 'Не приходит код подтверждения',
        a: 'Проверьте папку «Спам» и адрес почты. Если письмо не пришло за 5 минут — запросите код повторно на экране входа или напишите в поддержку.',
      },
      {
        q: 'Как сменить пароль',
        a: 'Откройте Настройки → Безопасность → «Изменить пароль». После смены пароля доверенные устройства сбрасываются — при следующем входе на них понадобится код из письма.',
      },
    ],
  },
  {
    category: 'Оплата и магазин',
    items: [
      {
        q: 'Списали деньги, но товар не пришёл',
        a: 'Оплата обрабатывается платёжным провайдером. Обычно товар появляется в течение нескольких минут. Если этого не произошло — создайте обращение с категорией «Ошибка оплаты или магазина».',
      },
      {
        q: 'Как вернуть средства',
        a: 'Возврат возможен в течение 14 дней, если товар не был использован. Напишите в поддержку с номером платежа.',
      },
    ],
  },
  {
    category: 'Игры и запуск',
    items: [
      {
        q: 'Игра не запускается',
        a: 'Перезагрузите лаунчер, проверьте целостность файлов в библиотеке и наличие свободного места. Если игра всё равно не стартует — создайте обращение «Проблема с запуском игры» и приложите логи.',
      },
      {
        q: 'Медленная загрузка игр',
        a: 'Скорость зависит от сети и нагрузки CDN. Попробуйте сменить подключение (Wi-Fi/мобильные данные) и повторите загрузку.',
      },
    ],
  },
];

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
