import * as SecureStore from 'expo-secure-store';

// SecureStore асинхронный, а заголовки запроса нужно собирать быстро.
// Держим значения в памяти, синхронизируя с защищённым хранилищем.
const mem = new Map<string, string>();

const KEYS = ['token', 'user', 'deviceId', 'deviceTokens', 'pushToken', 'adultConsent', 'adultOffered'] as const;

/** Загружает сохранённые значения в память — вызвать один раз при старте. */
export async function hydrateStorage(): Promise<void> {
  await Promise.all(
    KEYS.map(async (k) => {
      try {
        const v = await SecureStore.getItemAsync(k);
        if (v != null) mem.set(k, v);
      } catch {
        // хранилище недоступно — работаем без кэша
      }
    }),
  );
}

export function getCached(key: string): string {
  return mem.get(key) ?? '';
}

export async function setStored(key: string, value: string): Promise<void> {
  mem.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // не критично: значение останется только в памяти до перезапуска
  }
}

export async function removeStored(key: string): Promise<void> {
  mem.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

/** Хранит JSON-объект (user, deviceTokens) в SecureStore. */
export function getJSON<T>(key: string, fallback: T): T {
  const raw = mem.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await setStored(key, JSON.stringify(value));
}
