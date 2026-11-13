import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { Row, Section, ToggleRow } from '@/components/settings/ui';
import { L } from '@/constants/lustre';

const KEYS = {
  notifications: 'pref_ui_notifications',
  sounds: 'pref_ui_sounds',
  animations: 'pref_ui_animations',
} as const;

export default function InterfaceSettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [animations, setAnimations] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async (key: string, setter: (v: boolean) => void) => {
      try {
        const v = await SecureStore.getItemAsync(key);
        if (alive && v != null) setter(v === '1');
      } catch {
        // хранилище недоступно — оставляем значение по умолчанию
      }
    };
    void load(KEYS.notifications, setNotifications);
    void load(KEYS.sounds, setSounds);
    void load(KEYS.animations, setAnimations);
    return () => {
      alive = false;
    };
  }, []);

  const persist = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    void SecureStore.setItemAsync(key, value ? '1' : '0').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Интерфейс</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Отображение">
          <Row label="Масштаб интерфейса" hint="80%–150%" disabled />
          <Row label="Тема лаунчера" hint="Перекрашивает интерфейс лаунчера" disabled />
          <Row label="Размытие фона лаунчера" hint="0–24 px" disabled />
          <Row label="Анимации перехода" hint="Экраны лаунчера между разделами" disabled last />
        </Section>

        <Section title="Приложение">
          <ToggleRow
            label="Показывать уведомления"
            value={notifications}
            onValueChange={(v) => persist(KEYS.notifications, v, setNotifications)}
          />
          <ToggleRow
            label="Звуки интерфейса"
            value={sounds}
            onValueChange={(v) => persist(KEYS.sounds, v, setSounds)}
          />
          <ToggleRow
            label="Анимации"
            value={animations}
            onValueChange={(v) => persist(KEYS.animations, v, setAnimations)}
            last
          />
        </Section>
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
}));
