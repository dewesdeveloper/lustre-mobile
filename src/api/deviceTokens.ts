import { getJSON, setJSON } from './storage';

const MAP_KEY = 'deviceTokens';

type TokenMap = Record<string, string>;

export function getDeviceTokenMap(): TokenMap {
  const value = getJSON<TokenMap>(MAP_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export function saveDeviceToken(username: string, token: string): void {
  if (!username || !token) return;
  const map = getDeviceTokenMap();
  map[username] = token;
  void setJSON(MAP_KEY, map);
}

export function getDeviceToken(username?: string): string {
  if (username) {
    const map = getDeviceTokenMap();
    if (map[username]) return map[username];
  }
  return '';
}

export function allDeviceTokens(): string[] {
  return Object.values(getDeviceTokenMap());
}

export function removeDeviceToken(username?: string): void {
  if (!username) return;
  const map = getDeviceTokenMap();
  delete map[username];
  void setJSON(MAP_KEY, map);
}
