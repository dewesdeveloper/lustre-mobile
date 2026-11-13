import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import api from '@/api/client';
import { Button, ErrorText, Input, Label, Screen } from '@/components/ui/form';
import { L } from '@/constants/lustre';

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error || err?.message || 'Не удалось зарегистрироваться';
}

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!username.trim() || !email.trim() || !password) {
      setError('Заполните все поля');
      return;
    }
    if (password.length < 8) {
      setError('Пароль — минимум 8 символов');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', {
        username: username.trim(),
        email: email.trim(),
        password,
        terms_accepted: terms,
        privacy_accepted: privacy,
      });
      if (data.need_verify) {
        router.push({ pathname: '/verify', params: { mode: 'verify', identity: data.email || email.trim() } });
        return;
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
        <Text style={styles.title}>Регистрация</Text>

        <Label>Логин</Label>
        <Input
          value={username}
          // только латиница: нелатиницу убираем прямо при вводе
          onChangeText={(t) => setUsername(t.replace(/[^A-Za-z0-9_.-]/g, ''))}
          autoCapitalize="none"
          maxLength={32}
          placeholder="минимум 3 символа"
        />
        <Text style={styles.hint}>Латинские буквы, цифры и символы _ . - (3–32)</Text>

        <Label>Email</Label>
        <Input
          value={email}
          onChangeText={(t) => setEmail(t.replace(/[^\x20-\x7e]/g, ''))}
          autoCapitalize="none"
          keyboardType="email-address"
          maxLength={254}
          placeholder="you@example.com"
        />
        <Text style={styles.hint}>Только латиницей, например you@example.com</Text>

        <Label>Пароль</Label>
        <Input
          value={password}
          onChangeText={(t) => setPassword(t.replace(/[^\x20-\x7e]/g, ''))}
          secureTextEntry
          maxLength={72}
          placeholder="минимум 8 символов"
        />
        <Text style={styles.hint}>Латинские буквы, цифры и символы (минимум 8)</Text>

        <View style={styles.checkboxes}>
          <Checkbox checked={terms} onToggle={() => setTerms((v) => !v)} text="Согласен с пользовательским соглашением" />
          <Checkbox checked={privacy} onToggle={() => setPrivacy((v) => !v)} text="Согласен с политикой конфиденциальности" />
        </View>

        <ErrorText>{error}</ErrorText>

        <Button title="Создать аккаунт" onPress={submit} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Уже есть аккаунт? </Text>
          <Link href="/login" style={styles.footerLink}>
            Войти
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
  title: {
    color: L.text,
    fontSize: 26, fontFamily: 'Tiny5',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  hint: { color: L.muted, fontSize: 11, marginTop: 4, marginBottom: 4 },
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  footerLink: { color: L.accent, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
}));
