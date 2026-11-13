import api from './client';

export interface TotpSetupResult {
  secret: string;
  otpauth_url: string;
}

export async function totpStatus(): Promise<boolean> {
  const res = await api.get('/auth/totp/status');
  return !!res.data?.enabled;
}

export async function totpSetup(): Promise<TotpSetupResult> {
  const res = await api.post('/auth/totp/setup');
  return res.data as TotpSetupResult;
}

export async function totpEnable(code: string): Promise<string[]> {
  const res = await api.post('/auth/totp/enable', { code });
  return (res.data?.recovery_codes as string[]) || [];
}

export async function totpDisable(code: string): Promise<void> {
  await api.post('/auth/totp/disable', { code });
}
