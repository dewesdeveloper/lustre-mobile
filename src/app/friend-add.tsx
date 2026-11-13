import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { findByCode, sendFriendRequest, type FoundUser } from '@/api/friends';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function AddFriendScreen() {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<FoundUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const search = async () => {
    const value = code.trim();
    if (!value) {
      setError('Введите код друга');
      return;
    }
    setSearching(true);
    setError('');
    setFound(null);
    setDone('');
    try {
      setFound(await findByCode(value));
    } catch (e) {
      setError(apiError(e, 'Пользователь с таким кодом не найден'));
    } finally {
      setSearching(false);
    }
  };

  const send = async () => {
    const value = code.trim();
    if (!value && !found) return;
    setSending(true);
    setError('');
    try {
      await sendFriendRequest(found ? { friend_id: found.id } : { friend_code: value });
      setDone(found ? `Заявка отправлена @${found.username}` : 'Заявка отправлена');
      setFound(null);
      setCode('');
    } catch (e) {
      setError(apiError(e, 'Не удалось отправить заявку'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Добавить друга</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Код друга — 10 цифр. Его видно в профиле пользователя в лаунчере или в приложении.
        </Text>

        <Label>Код друга</Label>
        <Input
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="0000000000"
        />

        {found ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              {found.profile?.avatar_url ? (
                <Image source={{ uri: found.profile.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(found.username || '?')[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{found.profile?.display_name || found.username}</Text>
              <Text style={styles.cardSub}>@{found.username}</Text>
            </View>
          </View>
        ) : null}

        <ErrorText>{error}</ErrorText>
        {done ? <Text style={styles.done}>{done}</Text> : null}

        <Button
          title={found ? 'Отправить заявку' : 'Найти'}
          onPress={found ? send : search}
          loading={searching || sending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 24, paddingTop: 8 },
  hint: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 14, marginTop: 16 },
  avatar: { width: 48, height: 48, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48 },
  avatarText: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  cardSub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  done: { color: L.success, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 12 },
}));
