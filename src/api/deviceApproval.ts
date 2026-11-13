import api from './client';

export interface DeviceApprovalStatus {
  enabled: boolean;
  phone: string;
  phone_verified: boolean;
}

export async function getDeviceApprovalStatus(): Promise<DeviceApprovalStatus> {
  const res = await api.get('/auth/device-approval/status');
  return res.data as DeviceApprovalStatus;
}

/** Запросить код привязки номера. */
export async function requestPhoneCode(phone: string): Promise<{ message?: string }> {
  const res = await api.post('/auth/phone/request', { phone });
  return res.data;
}

export async function verifyPhoneCode(code: string): Promise<void> {
  await api.post('/auth/phone/verify', { code });
}

export async function enableDeviceApproval(): Promise<void> {
  await api.post('/auth/device-approval/enable');
}

export async function disableDeviceApproval(): Promise<void> {
  await api.post('/auth/device-approval/disable');
}

export async function approveLogin(loginToken: string): Promise<void> {
  await api.post('/auth/login-approval', { login_token: loginToken });
}

export async function denyLogin(loginToken: string): Promise<void> {
  await api.post('/auth/login-approval/deny', { login_token: loginToken });
}
