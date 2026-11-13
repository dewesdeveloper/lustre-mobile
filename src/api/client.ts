import axios, { type InternalAxiosRequestConfig } from 'axios';
import { AppState } from 'react-native';

import { API_URL } from './config';
import { getCachedDeviceInfo } from './device';
import { allDeviceTokens } from './deviceTokens';
import { getCached, setStored } from './storage';

// eslint-disable-next-line import/no-named-as-default-member -- axios.create — штатный API
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // В React Native кросс-сайтовые cookie не используются — авторизация через Bearer.
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = getCached('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const device = getCachedDeviceInfo();
  if (device.id) {
    config.headers['X-Device-Id'] = device.id;
    config.headers['X-Device-Name'] = device.name;
    config.headers['X-Device-Platform'] = device.platform;
  }

  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

// Сервер отдаёт сессионный токен в теле — сохраняем его для последующих запросов.
// Кроме /calls/token: там токен LiveKit, и его сохранение затирало сессию —
// после любого звонка все запросы получали 401 и пользователя выбрасывало.
api.interceptors.response.use(
  (response) => {
    const issued = (response.data as { token?: unknown } | undefined)?.token;
    const url = response.config?.url || '';
    if (typeof issued === 'string' && issued && !url.startsWith('/calls/token')) {
      void setStored('token', issued);
    }
    return response;
  },
  async (error) => {
    // 401 — токен мог истечь (живёт 72 ч): один раз продлеваем (на доверенном устройстве —
    // даже истёкший) и повторяем запрос. Без этого мобилка разлогинивала каждые 3 дня.
    const config = error?.config as RetryConfig | undefined;
    const url = config?.url || '';
    if (
      error?.response?.status === 401 && config && !config._retriedAfterRefresh &&
      getCached('token') && !NO_REFRESH.some((p) => url.startsWith(p))
    ) {
      config._retriedAfterRefresh = true;
      const outcome = await refreshSessionOutcome();
      if (outcome === 'ok') {
        config.headers.Authorization = `Bearer ${getCached('token')}`;
        return api(config);
      }
      // Нет сети / сбой сервера — это не выход из аккаунта
      if (outcome === 'unavailable') error.sessionCheckUnavailable = true;
    }
    return Promise.reject(error);
  },
);

const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/logout', '/auth/register', '/auth/confirm', '/auth/verify-email', '/auth/reset-password', '/auth/forgot-password'];

export type RefreshOutcome = 'ok' | 'denied' | 'unavailable';
let refreshing: Promise<RefreshOutcome> | null = null;

/** Продлить сессию; параллельные вызовы ждут один запрос. */
export function refreshSessionOutcome(): Promise<RefreshOutcome> {
  if (!refreshing) {
    refreshing = api
      .post('/auth/refresh', { device_tokens: allDeviceTokens() }, { _retriedAfterRefresh: true } as RetryConfig)
      .then((res): RefreshOutcome => (res.data?.token ? 'ok' : 'unavailable'))
      .catch((err): RefreshOutcome => (err?.response?.status === 401 ? 'denied' : 'unavailable'))
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function tokenExpiry(): number | null {
  const payload = getCached('token')?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

const RENEW_BEFORE_MS = 48 * 3600_000;

/** Пока пользователь в аккаунте — продлеваем сессию заранее (раз в 30 мин и при возврате в приложение). */
export function startSessionKeepAlive(): () => void {
  const check = () => {
    const exp = tokenExpiry();
    if (exp !== null && exp - Date.now() < RENEW_BEFORE_MS) void refreshSessionOutcome();
  };
  check();
  const timer = setInterval(check, 30 * 60_000);
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') check();
  });
  return () => {
    clearInterval(timer);
    sub.remove();
  };
}

export default api;
