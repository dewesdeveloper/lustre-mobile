import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { ShieldCheck, X, Check } from 'lucide-react-native';

import { approveLogin, denyLogin } from '@/api/deviceApproval';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';

export default function ApproveScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token || '';
  const { user, isLoading } = useAuth();
  const [done, setDone] = useState<'approved' | 'denied' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) return null;
  // Для подтверждения нужно быть авторизованным в том же аккаунте
  if (!user) return <Redirect href={{ pathname: '/login', params: { next: `/approve?token=${token}` } }} />;

  const handle = async (approve: boolean) => {
    if (!token) {
      setError('Нет токена подтверждения');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (approve) {
        await approveLogin(token);
        setDone('approved');
      } else {
        await denyLogin(token);
        setDone('denied');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'Не удалось обработать запрос');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {done ? (
          <>
            <View style={[styles.iconWrap, done === 'approved' ? styles.iconOk : styles.iconNo]}>
              {done === 'approved' ? <Check size={34} color="#fff" /> : <X size={34} color="#fff" />}
            </View>
            <Text style={styles.title}>{done === 'approved' ? 'Вход подтверждён' : 'Вход отклонён'}</Text>
            <Text style={styles.subtitle}>
              {done === 'approved'
                ? 'Можно вернуться к компьютеру — вход выполнен.'
                : 'Запрос на вход отклонён.'}
            </Text>
            <Pressable style={styles.primary} onPress={() => router.replace('/(tabs)' as Href)}>
              <Text style={styles.primaryText}>Готово</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.iconWrap, styles.iconPending]}>
              <ShieldCheck size={34} color={L.accent} />
            </View>
            <Text style={styles.title}>Подтверждение входа</Text>
            <Text style={styles.subtitle}>
              Кто-то пытается войти в аккаунт <Text style={styles.acc}>@{user.username}</Text> на другом устройстве.
              Подтвердите, только если это вы.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => handle(true)}>
              <Text style={styles.primaryText}>Подтвердить вход</Text>
            </Pressable>
            <Pressable style={[styles.ghost, busy && styles.disabled]} disabled={busy} onPress={() => handle(false)}>
              <Text style={styles.ghostText}>Это не я — отклонить</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: { width: 84, height: 84, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  iconPending: { backgroundColor: 'rgba(255,0,110,0.12)', borderWidth: 1, borderColor: L.accent },
  iconOk: { backgroundColor: L.success },
  iconNo: { backgroundColor: L.danger },
  title: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', marginTop: 22, textAlign: 'center' },
  subtitle: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 21, textAlign: 'center', marginTop: 12 },
  acc: { color: L.text, fontWeight: '800' },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 14, textAlign: 'center' },
  primary: { width: '100%', backgroundColor: L.accent, borderRadius: 0, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  primaryText: { color: '#fff', fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 2 },
  ghost: { width: '100%', borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  ghostText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2 },
  disabled: { opacity: 0.5 },
}));
