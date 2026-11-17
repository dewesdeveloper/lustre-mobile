import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, Linking } from 'react-native';
import { Link, router } from 'expo-router';

import api from '@/api/client';
import { allDeviceTokens } from '@/api/deviceTokens';
import { Button, ErrorText, Input, Label, Screen } from '@/components/ui/form';
import SocialLogin from '@/components/auth/SocialLogin';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error || err?.message || 'Не удалось войти';
}

export default function LoginScreen() {
  const { completeAuth } = useAuth();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!identity.trim() || !password) {
      setError('Введите логин и пароль');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', {
        identity: identity.trim(),
        password,
        terms_accepted: terms,
        privacy_accepted: privacy,
        device_tokens: allDeviceTokens(),
      });

      if (data.need_verify) {
        router.push({ pathname: '/verify', params: { mode: 'verify', identity: data.email || identity.trim() } });
        return;
      }
      if (data.need_totp) {
        router.push({ pathname: '/verify', params: { mode: 'totp', login_token: data.login_token } });
        return;
      }
      if (data.need_code) {
        router.push({ pathname: '/verify', params: { mode: 'login', login_token: data.login_token } });
        return;
      }
      if (data.user) {
        await completeAuth(data.user, data.device_token);
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>LUSTRE</Text>
        <Text style={styles.subtitle}>Войдите, чтобы продолжить</Text>

        <Label>Логин или почта</Label>
        <Input
          value={identity}
          onChangeText={setIdentity}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="логин или email"
        />

        <Label>Пароль</Label>
        <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

        <View style={styles.checkboxes}>
          <Checkbox checked={terms} onToggle={() => setTerms((v) => !v)} text="Согласен с пользовательским соглашением" />
          <Checkbox checked={privacy} onToggle={() => setPrivacy((v) => !v)} text="Согласен с политикой конфиденциальности" />
        </View>

        <ErrorText>{error}</ErrorText>

        <Button title="Войти" onPress={submit} loading={loading} />

        <SocialLogin
          consent={terms && privacy}
          onNeedConsent={() => setError('Чтобы войти через сервис, отметьте согласие с соглашением и политикой конфиденциальности')}
        />

        {/* Вход через Google отключён (17.11.2026): пароль задают через восстановление на сайте */}
        <Text style={styles.googleHint}>
          Входили через Google? Этот способ входа отключён. Задайте пароль по почте Gmail на странице{' '}
          <Text style={styles.footerLink} onPress={() => Linking.openURL('https://lustrehub.pro/reset-password')}>
            восстановления пароля
          </Text>
          {' '}— аккаунт и прогресс сохранены.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Нет аккаунта? </Text>
          <Link href="/register" style={styles.footerLink}>
            Зарегистрироваться
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Checkbox({ checked, onToggle, text }: { checked: boolean; onToggle: () => void; text: string }) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]} />
      <Text style={styles.checkboxText}>{text}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  scroll: { paddingBottom: 48 },
  logo: {
    color: L.text,
    fontSize: 34, fontFamily: 'Tiny5',
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  checkboxes: { marginTop: 20, gap: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: L.card,
  },
  checkboxOn: { backgroundColor: L.accent, borderColor: L.accent },
  checkboxText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', flex: 1 },
  googleHint: { color: L.muted, fontSize: 12, lineHeight: 18, marginTop: 18, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  footerLink: { color: L.accent, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
}));
