import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import api from '@/api/client';
import { Button, ErrorText, Input, Label, Screen } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error || err?.message || 'Не удалось подтвердить код';
}

export default function VerifyScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    identity?: string;
    login_token?: string;
    }>();
  const { completeAuth } = useAuth();
  const isTotp = params.mode === 'totp';
  const isLogin = params.mode === 'login';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    if (code.trim().length < 4) {
      setError('Введите код из письма');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isTotp) {
        const { data } = await api.post('/auth/confirm-totp', {
          login_token: params.login_token,
          code: code.trim(),
        });
        if (data.user) await completeAuth(data.user, data.device_token);
      } else if (isLogin) {
        const { data } = await api.post('/auth/confirm-login', {
          login_token: params.login_token,
          code: code.trim(),
        });
        if (data.user) await completeAuth(data.user, data.device_token);
      } else {
        const { data } = await api.post('/auth/verify-email', {
          identity: params.identity,
          code: code.trim(),
        });
        if (data.user) await completeAuth(data.user, data.device_token);
      }
      router.replace('/(tabs)');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (isTotp) return;
    setResending(true);
    setError('');
    try {
      const payload = isLogin ? { login_token: params.login_token } : { identity: params.identity };
      const { data } = await api.post('/auth/resend-code', payload);
      if (data.mail_failed) setError(data.message || 'Не удалось отправить письмо');
      else setInfo('Код отправлен повторно');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>
        {isTotp ? 'Двухфакторный вход' : isLogin ? 'Подтверждение входа' : 'Подтверждение почты'}
      </Text>
      <Text style={styles.hint}>
        {isTotp
          ? 'Введите 6-значный код из приложения-аутентификатора'
          : isLogin
            ? 'Введите код из письма для входа в аккаунт'
            : `Мы отправили код на ${params.identity ?? 'вашу почту'}`}
      </Text>

      <Label>{isTotp ? 'Код приложения' : 'Код из письма'}</Label>
      <Input
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        style={styles.code}
      />

      {info ? <Text style={styles.info}>{info}</Text> : null}
      <ErrorText>{error}</ErrorText>

      <Button title="Подтвердить" onPress={submit} loading={loading} />

      {!isTotp && (
        <Button title="Отправить код заново" onPress={resend} loading={resending} variant="ghost" />
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  title: {
    color: L.text,
    fontSize: 24, fontFamily: 'Tiny5',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 32,
  },
  hint: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10, lineHeight: 19 },
  code: { fontSize: 24, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 8, textAlign: 'center' },
  info: { color: L.violet, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 12 },
}));
