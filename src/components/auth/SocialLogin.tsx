import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import api from '@/api/client';
import { setStored } from '@/api/storage';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';
import { themedStyles } from '@/theme/themedStyles';
import { apiError } from '@/utils/apiError';

// Вход через сервисы (Steam, GitHub, Google, Telegram). Сервис открывается во встроенном
// браузере, а приложение опрашивает /auth/oauth/result — так же, как лаунчер: возвращаться
// в приложение по ссылке не нужно. Готовый токен сохраняется как при обычном входе.

const META: Record<string, { name: string; letter: string; color: string }> = {
  steam: { name: 'Steam', letter: 'S', color: '#66c0f4' },
  github: { name: 'GitHub', letter: 'G', color: '#e6edf3' },
  google: { name: 'Google', letter: 'G', color: '#ea4335' },
  telegram: { name: 'Telegram', letter: 'T', color: '#29a9eb' },
};

const REASON: Record<string, string> = {
  state: 'Сессия входа истекла. Попробуйте снова.',
  code: 'Сервис не вернул код входа.',
  token: 'Не удалось подтвердить вход у сервиса.',
  userinfo: 'Не удалось получить профиль.',
  user: 'Не удалось создать аккаунт.',
  steam: 'Steam не подтвердил вход.',
  telegram: 'Telegram отклонил вход.',
  expired: 'Время входа истекло. Попробуйте ещё раз.',
};

type Result = {
  status?: string;
  token?: string;
  reason?: string;
  username?: string;
  device_token?: string;
  login_token?: string;
  message?: string;
};

export default function SocialLogin({ consent, onNeedConsent }: {
  /** отмечены согласия с соглашением и политикой — сервер зафиксирует их у нового аккаунта */
  consent: boolean;
  onNeedConsent: () => void;
}) {
  const { completeAuth } = useAuth();
  const [providers, setProviders] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    api.get<{ providers?: string[] }>('/auth/oauth/providers')
      .then(({ data }) => alive.current && setProviders((data.providers || []).filter((p) => p in META)))
      .catch(() => {});
    return () => { alive.current = false; };
  }, []);

  const start = async (provider: string) => {
    if (busy) return;
    if (!consent) { onNeedConsent(); return; }
    setBusy(provider);
    setError('');
    try {
      const { data } = await api.get<{ url: string; state: string; poll: string }>(
        `/auth/oauth/start/${provider}`, { params: { consent: 1 } },
      );
      void WebBrowser.openBrowserAsync(data.url).catch(() => {});
      // ждём до 5 минут: 200 опросов раз в 1,5 с
      for (let attempt = 0; attempt < 200 && alive.current; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        let res: Result;
        try {
          res = (await api.get<Result>('/auth/oauth/result', { params: { state: data.state, poll: data.poll } })).data;
        } catch { continue; }

        if (res.status === 'ok' && res.token) {
          WebBrowser.dismissBrowser();
          await setStored('token', res.token);
          const me = await api.get('/auth/me');
          await completeAuth(me.data.user, res.device_token);
          router.replace('/(tabs)');
          return;
        }
        if (res.status === 'need_totp' && res.login_token) {
          WebBrowser.dismissBrowser();
          router.push({ pathname: '/verify', params: { mode: 'totp', login_token: res.login_token } });
          return;
        }
        if (res.status === 'need_device_approval') {
          WebBrowser.dismissBrowser();
          setError(res.message || 'Подтвердите вход на устройстве, где вы уже вошли в Lustre, и попробуйте снова.');
          return;
        }
        if (res.status === 'error') {
          WebBrowser.dismissBrowser();
          setError(REASON[res.reason || ''] || 'Не удалось войти через сервис');
          return;
        }
      }
      if (alive.current) setError(REASON.expired);
    } catch (e) {
      setError(apiError(e, 'Не удалось начать вход через сервис'));
    } finally {
      if (alive.current) setBusy('');
    }
  };

  if (providers.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>или войти через</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.grid}>
        {providers.map((p) => {
          const m = META[p];
          const active = busy === p;
          return (
            <Pressable key={p} style={[styles.btn, !!busy && !active && { opacity: 0.5 }]} disabled={!!busy} onPress={() => void start(p)}>
              {active
                ? <ActivityIndicator size="small" color={m.color} />
                : <Text style={[styles.letter, { color: m.color, borderColor: m.color }]}>{m.letter}</Text>}
              <Text style={styles.name}>{active ? 'Ждём браузер…' : m.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {busy ? <Text style={styles.hint}>Войдите в сервис в открывшемся окне — вход завершится сам.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { marginTop: 24 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  line: { flex: 1, height: 1, backgroundColor: L.border },
  dividerText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: L.border, backgroundColor: L.card,
  },
  letter: { width: 24, height: 24, borderWidth: 1, textAlign: 'center', lineHeight: 22, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  name: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  hint: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10, lineHeight: 16 },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10 },
}));
