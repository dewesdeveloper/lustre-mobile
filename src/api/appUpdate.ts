import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';

import api from '@/api/client';

// Автообновление (Android): сервер отдаёт номер последней сборки APK и ссылки на файл —
// основную (наш сервер) и запасную (GitHub). Скачиваем APK в кэш и открываем системный
// установщик; Android сам спросит разрешение «Устанавливать из этого источника».

export type AndroidRelease = {
  version?: string;
  version_code: number;
  url: string;
  fallback_url?: string;
  size?: number;
  notes?: string;
};

const SNOOZE_KEY = 'lh_update_snooze';
const SNOOZE_MS = 12 * 60 * 60 * 1000; // «Позже» — не напоминать полсуток об этой сборке

/** Номер текущей сборки (versionCode); 0 — неизвестен */
export function currentBuild(): number {
  return Number(Application.nativeBuildVersion || 0) || 0;
}

export function currentVersion(): string {
  return Application.nativeApplicationVersion || '';
}

/** Новая сборка, если она есть (null — обновлять нечего или не Android) */
export async function checkForUpdate(opts: { ignoreSnooze?: boolean } = {}): Promise<AndroidRelease | null> {
  if (Platform.OS !== 'android') return null;
  const { data } = await api.get<AndroidRelease>('/app/android/latest');
  const build = currentBuild();
  if (!data?.version_code || !data.url || build <= 0 || data.version_code <= build) return null;
  if (!opts.ignoreSnooze) {
    try {
      const raw = await SecureStore.getItemAsync(SNOOZE_KEY);
      const s = raw ? (JSON.parse(raw) as { code: number; until: number }) : null;
      if (s && s.code === data.version_code && Date.now() < s.until) return null;
    } catch { /* повреждённое значение — показываем */ }
  }
  return data;
}

export async function snoozeUpdate(code: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(SNOOZE_KEY, JSON.stringify({ code, until: Date.now() + SNOOZE_MS }));
  } catch { /* не критично */ }
}

async function download(url: string, target: string, onProgress: (p: number) => void, size?: number): Promise<void> {
  await FileSystem.deleteAsync(target, { idempotent: true });
  const task = FileSystem.createDownloadResumable(url, target, {}, (e) => {
    const total = e.totalBytesExpectedToWrite > 0 ? e.totalBytesExpectedToWrite : size || 0;
    if (total > 0) onProgress(Math.min(1, e.totalBytesWritten / total));
  });
  const res = await task.downloadAsync();
  if (!res || res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res?.status ?? '—'}`);
  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists || (size && 'size' in info && info.size !== size)) throw new Error('файл скачался не полностью');
}

/**
 * Скачать APK (сначала с нашего сервера, при сбое — с GitHub) и открыть установщик.
 * Бросает ошибку, если не получилось ни с одного адреса.
 */
export async function downloadAndInstall(rel: AndroidRelease, onProgress: (p: number) => void): Promise<void> {
  const target = `${FileSystem.cacheDirectory}Lustre-${rel.version_code}.apk`;
  const urls = [rel.url, rel.fallback_url].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      onProgress(0);
      // размер известен только для файла с зеркала (GitHub отдаёт тот же APK, но проверим по заголовку)
      await download(url, target, onProgress, url === rel.url ? rel.size : undefined);
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  const contentUri = await FileSystem.getContentUriAsync(target);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
