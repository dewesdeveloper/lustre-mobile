import { useEffect } from 'react';

import { getNotifications } from '@/api/push';
import { getCached, setStored } from '@/api/storage';
import { realEmail } from '@/components/settings/LinkedAccounts';
import { useAuth } from '@/context/AuthContext';

// Аккаунт из Steam/GitHub/Google/Telegram без почты: раз в день — системное уведомление
// «Привяжите почту». Нажатие открывает настройки аккаунта (data.url → useNotificationObserver).

const KEY = (userId: number) => `email_reminder_${userId}`;
/** Не в первые секунды запуска: там вход и проверка обновлений */
const DELAY_MS = 6000;

export function useEmailReminder(): void {
  const { user } = useAuth();
  const userId = user?.id;
  const missing = !!userId && !realEmail(user?.email);

  useEffect(() => {
    if (!missing || !userId) return;
    const today = new Date().toDateString();
    if (getCached(KEY(userId)) === today) return;
    const N = getNotifications();
    if (!N) return;
    const timer = setTimeout(() => {
      N.scheduleNotificationAsync({
        content: {
          title: 'Привяжите почту',
          body: 'У аккаунта нет почты: без неё не восстановить доступ, если вход через сервис станет недоступен.',
          data: { url: '/settings/account' },
        },
        trigger: null,
      })
        .then(() => setStored(KEY(userId), today))
        .catch(() => { /* нет разрешения на уведомления — напомним в настройках */ });
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [missing, userId]);
}
