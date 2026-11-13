import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getCached, setStored } from './storage';

export type DeviceInfo = {
  id: string;
  name: string;
  platform: string;
};

let cached: DeviceInfo = { id: '', name: '', platform: '' };

export function getCachedDeviceInfo(): DeviceInfo {
  return cached;
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Инициализирует стабильный идентификатор устройства (для доверенных устройств). */
export async function initDeviceInfo(): Promise<void> {
  let id = getCached('deviceId');
  if (!id) {
    id = randomId();
    await setStored('deviceId', id);
  }

  const platform = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  const model = Device.modelName || Device.deviceName || 'Mobile';

  cached = { id, name: `${model} · ${platform}`, platform };
}
