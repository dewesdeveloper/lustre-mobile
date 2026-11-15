import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { getPrivacy, updatePrivacy, type PrivacySettings } from '@/api/privacy';
import { Seg, Section, ToggleRow } from '@/components/settings/ui';
import DataState from '@/components/ui/DataState';
import { ErrorText } from '@/components/ui/form';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

const VISIBILITY_OPTIONS = [
  { id: 'public' as const, label: 'Публичный' },
  { id: 'friends' as const, label: 'Только друзья' },
  { id: 'private' as const, label: 'Скрытый' },
];

const ACTIVITY_OPTIONS = [
  { id: 'public' as const, label: 'Все пользователи' },
  { id: 'friends' as const, label: 'Только друзья' },
  { id: 'private' as const, label: 'Только я' },
];

const WHO_OPTIONS = [
  { id: 'everyone' as const, label: 'Все пользователи' },
  { id: 'friends' as const, label: 'Только друзья' },
];

export default function PrivacySettingsScreen() {
  const [p, setP] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    setLoading(true);
    getPrivacy()
      .then(setP)
      .catch((e) => setError(apiError(e, 'Не удалось загрузить настройки приватности')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      getPrivacy()
        .then(setP)
        .catch((e) => setError(apiError(e, 'Не удалось загрузить настройки приватности')))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const upd = async (patch: Partial<PrivacySettings>) => {
    if (!p) return;
    const prev = p;
    setP({ ...p, ...patch });
    try {
      setP(await updatePrivacy(patch));
    } catch (e) {
      setP(prev);
      setError(apiError(e, 'Не удалось сохранить настройки приватности'));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Конфиденциальность</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <DataState loading={loading} error={error && !p ? error : ''} onRetry={load} />

        {p ? (
          <>
            <ErrorText>{error}</ErrorText>

            <Section title="Кто видит профиль" subtitle="Скрытый профиль не открывается никому, кроме тебя.">
              <Seg
                value={p.profile_visibility}
                onChange={(v) => void upd({ profile_visibility: v })}
                options={VISIBILITY_OPTIONS}
              />
            </Section>

            <Section title="Список друзей" subtitle="Влияет на вкладку друзей в профиле.">
              <Seg
                value={p.friends_visibility}
                onChange={(v) => void upd({ friends_visibility: v })}
                options={VISIBILITY_OPTIONS}
              />
            </Section>

            <Section title="Кому видно библиотеку" subtitle="Кто видит твои игры на вкладке «Игры» в профиле.">
              <Seg
                value={p.library_visibility ?? 'friends'}
                onChange={(v) => void upd({ library_visibility: v })}
                options={ACTIVITY_OPTIONS}
              />
            </Section>

            <Section
              title="Лента активности"
              subtitle="Кто видит твою активность в профиле (запуски игр, значки, комментарии).">
              <Seg
                value={p.activity_visibility}
                onChange={(v) => void upd({ activity_visibility: v })}
                options={ACTIVITY_OPTIONS}
              />
              <Text style={styles.note}>
                При «Только я» лента в твоём профиле не открывается никому, кроме тебя.
              </Text>
            </Section>

            <Section title="Заявки в друзья">
              <ToggleRow
                label="Получать заявки в друзья от всех пользователей"
                hint="Если выключено — другие не смогут отправить тебе заявку."
                value={p.friend_requests === 'everyone'}
                onValueChange={() =>
                  void upd({ friend_requests: p.friend_requests === 'everyone' ? 'nobody' : 'everyone' })
                }
              />
            </Section>

            <Section title="Личные сообщения" subtitle="Кто может писать:">
              <Seg value={p.dms} onChange={(v) => void upd({ dms: v })} options={WHO_OPTIONS} />
            </Section>

            <Section title="Голосовые звонки" subtitle="Кто может звонить:">
              <Seg value={p.calls} onChange={(v) => void upd({ calls: v })} options={WHO_OPTIONS} />
            </Section>

            <Section title="Онлайн-статус">
              <ToggleRow
                label="Показывать статус «в сети»"
                hint="Если выключено — другие будут видеть тебя офлайн, даже когда приложение запущено."
                value={p.show_online}
                onValueChange={() => void upd({ show_online: !p.show_online })}
              />
            </Section>
          </>
        ) : null}
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
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  note: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 16, marginTop: 10 },
}));
