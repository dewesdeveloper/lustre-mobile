import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import api from '@/api/client';
import { Row, Section } from '@/components/settings/ui';
import { Button, ErrorText, Input } from '@/components/ui/form';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';
import { themedStyles } from '@/theme/themedStyles';
import { apiError } from '@/utils/apiError';
import { openExternalUrl } from '@/utils/openUrl';

// Почта аккаунта (привязка кодом для аккаунтов из Steam/GitHub без почты)
// и сервисы, через которые можно войти.

type Service = { provider: string; linked: boolean; linked_at?: string; profile_url?: string };
type Links = {
  email: string;
  email_verified: boolean;
  has_password: boolean;
  phone_verified: boolean;
  services: Service[];
};

const NAME: Record<string, string> = { steam: 'Steam', github: 'GitHub', google: 'Google', telegram: 'Telegram', itch: 'itch.io' };

/** Заглушка вместо почты у аккаунтов из Steam/GitHub — показывать её нельзя */
export const realEmail = (email?: string | null) => (email && !/@oauth\.local$/i.test(email) ? email : '');

export default function LinkedAccounts() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<Links | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<Links>('/auth/linked-accounts').then((r) => { setData(r.data); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const { data: r } = await api.post('/auth/email/bind-start', { email: email.trim() });
      setSentTo(r.email || email.trim());
      setCode('');
    } catch (e) {
      setError(apiError(e, 'Не удалось отправить код'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/email/bind-confirm', { code: code.trim() });
      setOpen(false);
      setSentTo('');
      setEmail('');
      load();
      void refreshUser();
    } catch (e) {
      setError(apiError(e, 'Не удалось подтвердить код'));
    } finally {
      setBusy(false);
    }
  };

  if (failed || !data) return null;

  return (
    <>
      <Section
        title="Почта и вход"
        subtitle={data.email ? undefined : 'Аккаунт создан через внешний сервис, и почты у него нет. Привяжите её — тогда можно будет входить по почте и восстановить доступ.'}>
        <Row
          label="Электронная почта"
          value={data.email ? (data.email_verified ? 'Подтверждена' : 'Не подтверждена') : undefined}
          hint={data.email || 'Почта не указана'}
          onPress={() => { setOpen((v) => !v); setError(''); }}
        />
        {open ? (
          <View style={styles.form}>
            {!sentTo ? (
              <>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button title={data.email ? 'Сменить почту' : 'Отправить код'} onPress={() => void send()} loading={busy} disabled={!email.trim()} />
              </>
            ) : (
              <>
                <Text style={styles.note}>Код отправлен на {sentTo}. Проверьте и папку «Спам».</Text>
                <Input value={code} onChangeText={setCode} placeholder="Код из письма" keyboardType="number-pad" />
                <Button title="Подтвердить" onPress={() => void confirm()} loading={busy} disabled={!code.trim()} />
                <Button title="Другая почта" variant="ghost" onPress={() => { setSentTo(''); setError(''); }} />
              </>
            )}
            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
        ) : null}
        <Row
          label="Пароль"
          value={data.has_password ? 'Задан' : 'Не задан'}
          hint={data.has_password ? undefined : data.email ? 'Задайте через «Забыли пароль?» на экране входа' : 'Сначала привяжите почту'}
        />
        <Row label="Телефон" value={data.phone_verified ? 'Привязан' : 'Не привязан'} last />
      </Section>

      <Section title="Привязанные сервисы">
        {data.services.length === 0 ? (
          <Text style={styles.note}>Вход через внешние сервисы сейчас недоступен.</Text>
        ) : (
          data.services.map((s, i) => (
            <Row
              key={s.provider}
              label={NAME[s.provider] || s.provider}
              value={s.linked ? 'Привязан' : 'Не привязан'}
              hint={s.linked && s.linked_at ? `С ${new Date(s.linked_at).toLocaleDateString('ru-RU')}` : undefined}
              onPress={s.profile_url ? () => openExternalUrl(s.profile_url) : undefined}
              last={i === data.services.length - 1}
            />
          ))
        )}
      </Section>
    </>
  );
}

const styles = themedStyles(() => ({
  form: { gap: 10, paddingVertical: 12 },
  note: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
}));
