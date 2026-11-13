import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';

import { getNotifications, registerForPush, unregisterPush } from '@/api/push';
import { useAuth } from '@/context/AuthContext';

/** Регистрирует push-токен после входа и снимает при выходе. */
export function usePushRegistration(): void {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      void unregisterPush();
      return;
    }
    void registerForPush();
  }, [userId]);
}

/** Переход по нажатию на уведомление (deep-link через data.url). */
export function useNotificationObserver(): void {
  useEffect(() => {
    // Уведомления недоступны в вебе и в Expo Go — не трогаем модуль.
    if (Platform.OS === 'web') return;
    const N = getNotifications();
    if (!N) return;

    const redirect = (response: import('expo-notifications').NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data as
        | { type?: string; url?: unknown; conversation_id?: number; caller_id?: number; caller_username?: string }
        | undefined;
      // Звонок: открываем диалог с звонившим
      if (data?.type === 'call' && data.conversation_id) {
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: String(data.conversation_id),
            username: data.caller_username || 'Чат',
            otherId: String(data.caller_id ?? ''),
          },
        });
        return;
      }
      const url = data?.url;
      if (typeof url === 'string' && url) {
        router.push(url as Href);
      }
    };

    redirect(N.getLastNotificationResponse());
    const sub = N.addNotificationResponseReceivedListener(redirect);
    return () => sub.remove();
  }, []);
}
