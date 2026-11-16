import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import api from './client';
import { getCached, removeStored, setStored } from './storage';

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null | undefined;

/**
 * Удалённые push не работают в Expo Go начиная с SDK 53 и в вебе.
 * В этих средах `expo-notifications` бросает ошибку уже при импорте,
 * поэтому модуль нельзя тянуть статически.
 */
export function pushAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

/** Ленивая и безопасная загрузка expo-notifications. */
function notifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (!pushAvailable()) {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch (e) {
    console.warn('[push] expo-notifications недоступен:', e);
    cachedModule = null;
  }
  return cachedModule;
}

export function getNotifications(): NotificationsModule | null {
  return notifications();
}

// Показываем уведомления, когда приложение на переднем плане.
export function configureNotificationHandler(): void {
  const N = notifications();
  if (!N) return;
  N.setNotificationHandler({
    // сообщение от заглушённого собеседника (data.muted) — без звука
    handleNotification: async (n) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !(n?.request?.content?.data as { muted?: boolean } | undefined)?.muted,
      shouldSetBadge: false,
    }),
  });
  // Каналы и категории нужно создать заранее, до прихода push.
  void setupNotificationChannels();
}

/**
 * Создаёт Android-каналы и категорию уведомлений звонков.
 * Канал «calls» с максимальной важностью даёт heads-up (всплывающее) уведомление.
 */
export async function setupNotificationChannels(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Уведомления',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ff006e',
      });
      // тихий канал: сообщения заглушённых собеседников (низкая важность — без звука и вибрации)
      await N.setNotificationChannelAsync('quiet', {
        name: 'Без звука',
        importance: N.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
      });
      await N.setNotificationChannelAsync('calls', {
        name: 'Звонки',
        importance: N.AndroidImportance.MAX,
        // без sound: 'default' — на Android SDK 53+ expo-notifications трактует
        // 'default' как кастомный ресурс и ругается, что файла нет в сборке;
        // системный звук играет и так (важность MAX + вибрация).
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#ff006e',
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
      });
    }
    await N.setNotificationCategoryAsync('incoming_call', [
      { identifier: 'open', buttonTitle: 'Открыть', options: { opensAppToForeground: true } },
    ]);
  } catch (e) {
    console.warn('[push] setupNotificationChannels:', e);
  }
}

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Запрашивает разрешение и регистрирует Expo push-токен на бэкенде. */
export async function registerForPush(): Promise<string | null> {
  const N = notifications();
  if (!N) return null;
  if (!Device.isDevice) return null;

  await setupNotificationChannels();

  const existing = await N.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await N.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    // Без EAS projectId Expo push-токен не выдать (нужен `eas init`/`eas build`).
    console.warn('[push] нет EAS projectId — push недоступен');
    return null;
  }

  try {
    const token = (await N.getExpoPushTokenAsync({ projectId })).data;
    await api.post('/push/register', { token, platform: Platform.OS });
    await setStored('pushToken', token);
    return token;
  } catch (e) {
    // Типичная причина на dev-сборке: нет google-services.json (FCM).
    // Лечится добавлением файла + android.googleServicesFile в app.json и пересборкой натива.
    console.warn('[push] не удалось получить токен (проверьте googleServicesFile/FCM в app.json):', e);
    return null;
  }
}

/** Снимает токен с бэкенда (при выходе из аккаунта). */
export async function unregisterPush(): Promise<void> {
  const token = getCached('pushToken');
  if (!token) return;
  try {
    await api.post('/push/unregister', { token });
  } catch {
    // ignore
  }
  await removeStored('pushToken');
}
