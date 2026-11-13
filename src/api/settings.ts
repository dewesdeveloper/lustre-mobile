import api from './client';

export interface TrustedDevice {
  id: number;
  device_id: string;
  device_name: string;
  platform?: string;
  last_seen_at?: string | null;
  current?: boolean;
}

export interface TrustStatus {
  trusted: boolean;
  days_left: number;
  hours_left: number;
  forever: boolean;
}

export interface TrustStartResult {
  trust_token: string;
  message?: string;
  mail_failed?: boolean;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
}

export async function listTrustedDevices(deviceToken: string): Promise<TrustedDevice[]> {
  const res = await api.post('/auth/trusted-devices', { device_token: deviceToken });
  return (res.data?.devices as TrustedDevice[]) || [];
}

export async function removeTrustedDevice(id: number, deviceId: string): Promise<void> {
  await api.post('/auth/trusted-device-remove', { id, device_id: deviceId });
}

export async function renameTrustedDevice(id: number, deviceId: string, name: string): Promise<void> {
  await api.post('/auth/trusted-device-rename', { id, device_id: deviceId, name });
}

export async function revokeOtherTrustedDevices(deviceId: string): Promise<void> {
  await api.post('/auth/trusted-devices-revoke-others', { device_id: deviceId });
}

export async function trustedDeviceStatus(deviceToken: string): Promise<TrustStatus> {
  const res = await api.post('/auth/trusted-device-status', { device_token: deviceToken });
  return {
    trusted: !!res.data?.trusted,
    days_left: res.data?.days_left || 0,
    hours_left: res.data?.hours_left || 0,
    forever: !!res.data?.forever,
  };
}

export async function setTrustedDeviceDays(days: number): Promise<void> {
  await api.post('/auth/trusted-device-days', { days });
}

export async function revokeTrustedDevice(deviceToken: string): Promise<void> {
  await api.post('/auth/trusted-device-revoke', { device_token: deviceToken });
}

export async function startTrustDevice(): Promise<TrustStartResult> {
  const res = await api.post('/auth/trust-device-start', {});
  return res.data as TrustStartResult;
}

export async function confirmTrustDevice(trustToken: string, code: string): Promise<string> {
  const res = await api.post('/auth/confirm-trust', { trust_token: trustToken, code });
  return res.data?.device_token || '';
}
