import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Download, MonitorDown, Star } from 'lucide-react-native';

import api from '@/api/client';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type LibraryEntry = {
  id: number;
  game_id?: number;
  favorite?: boolean;
  game?: {
    ID?: number;
    title?: string;
    developer?: string;
    header_image?: string;
    banner_url?: string;
    age_rating?: string;
  };
};

function gamesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'игра';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'игры';
  return 'игр';
}

/**
 * Загрузки (мобильная версия). Десктопная страница целиком завязана на
 * Electron (торренты, установка, запуск, пути) — на телефоне показываем
 * только список игр из библиотеки и подсказку об установке в десктоп-клиенте.
 */
export default function DownloadsScreen() {
  const [items, setItems] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/library/')
      .then((r) => setItems(Array.isArray(r.data) ? (r.data as LibraryEntry[]) : []))
      .catch((e) => {
        setItems([]);
        setError(apiError(e, 'Не удалось загрузить список игр'));
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>

      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Download size={22} color={L.accent} />
          <Text style={styles.title}>Загрузки</Text>
        </View>
        {!loading && !error ? (
          <Text style={styles.count}>
            {items.length} {gamesWord(items.length)} в библиотеке
          </Text>
        ) : null}
      </View>

      <View style={styles.notice}>
        <MonitorDown size={16} color={L.violet} />
        <Text style={styles.noticeText}>
          Загрузка и установка игр выполняются в десктоп-клиенте Lustre на компьютере. Здесь доступен список ваших
          игр.
        </Text>
      </View>

      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<DataState empty emptyText="В библиотеке пока нет игр" />}
          renderItem={({ item }) => {
            const gameId = item.game_id ?? item.game?.ID;
            const image = item.game?.header_image || item.game?.banner_url;
            return (
              <Pressable
                onPress={() => {
                  if (gameId) router.push(`/game/${gameId}` as Href);
                }}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                {image ? <Image source={{ uri: image }} style={styles.thumb} /> : null}
                <View style={styles.body}>
                  <View style={styles.titleRow2}>
                    <Text style={styles.gameTitle} numberOfLines={1}>{item.game?.title || 'Игра'}</Text>
                    {item.favorite ? <Star size={12} color="#fbbf24" fill="#fbbf24" /> : null}
                  </View>
                  {item.game?.developer ? (
                    <Text style={styles.dev} numberOfLines={1}>{item.game.developer}</Text>
                  ) : null}
                  {item.game?.age_rating ? <Text style={styles.age}>{item.game.age_rating}</Text> : null}
                  <View style={styles.note}>
                    <Text style={styles.noteText}>Установка доступна в десктоп-клиенте</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },

  head: { paddingHorizontal: 16, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: L.text, fontSize: 26, fontFamily: 'Tiny5', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -0.8 },
  count: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 6,
    marginLeft: 32,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(131,56,236,0.25)',
    backgroundColor: 'rgba(131,56,236,0.08)',
    borderRadius: 0,
    padding: 14,
  },
  noticeText: { flex: 1, color: 'rgba(244,244,246,0.6)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },

  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
  },
  pressed: { opacity: 0.8 },
  thumb: { width: 96, height: 64, borderRadius: 0, backgroundColor: '#000' },
  body: { flex: 1, minWidth: 0 },
  titleRow2: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gameTitle: { flex: 1, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  dev: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  age: {
    alignSelf: 'flex-start',
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_400Regular',
    backgroundColor: L.cardAlt,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  note: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  noteText: {
    color: 'rgba(244,244,246,0.45)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
}));
