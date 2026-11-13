import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { router, useFocusEffect, type Href } from 'expo-router';

import api from '@/api/client';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type Entry = {
  id: number;
  game_id?: number;
  favorite?: boolean;
  game?: {
    ID?: number;
    title?: string;
    developer?: string;
    header_image?: string;
    banner_url?: string;
  };
};

const PAGE = 30;

export default function LibraryScreen() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(async (reset: boolean) => {
    if (reset) {
      offsetRef.current = 0;
      hasMoreRef.current = true;
      setLoading(true);
      setError('');
    } else {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const offset = reset ? 0 : offsetRef.current;
      const res = await api.get('/library/', { params: { limit: PAGE, offset } });
      const chunk = Array.isArray(res.data) ? (res.data as Entry[]) : [];
      const count = Number(res.headers?.['x-total-count']) || chunk.length;
      setItems((prev) => (reset ? chunk : [...prev, ...chunk]));
      offsetRef.current = offset + chunk.length;
      hasMoreRef.current = chunk.length === PAGE && offset + chunk.length < count;
    } catch (e) {
      if (reset) setError(apiError(e, 'Не удалось загрузить библиотеку'));
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPage(true);
    }, [loadPage]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Библиотека</Text>
      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={() => { void loadPage(true); }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onEndReached={() => { void loadPage(false); }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={L.accent} style={{ marginVertical: 18 }} /> : null
          }
          ListEmptyComponent={<DataState empty emptyText="В библиотеке пусто" />}
          renderItem={({ item }) => {
            const gameId = item.game_id ?? item.game?.ID;
            const cover = item.game?.header_image || item.game?.banner_url;
            return (
              <Pressable
                onPress={() => {
                  if (gameId) router.push(`/game/${gameId}` as Href);
                }}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, styles.coverFallback]}>
                    <Text style={styles.coverLetter}>{(item.game?.title || '?')[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.gameTitle} numberOfLines={2}>
                    {item.game?.title || 'Игра'}
                  </Text>
                  {item.game?.developer ? (
                    <Text style={styles.dev} numberOfLines={1}>
                      {item.game.developer}
                    </Text>
                  ) : null}
                </View>
                {item.favorite ? <Star size={16} color={L.accent} fill={L.accent} /> : null}
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
  title: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', letterSpacing: 1, padding: 24, paddingBottom: 8 },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    padding: 12,
  },
  cardPressed: { opacity: 0.7 },
  cover: { width: 56, height: 76, borderWidth: 1, borderColor: L.border, backgroundColor: L.cardAlt },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverLetter: { color: L.muted, fontSize: 20, fontFamily: 'Tiny5' },
  info: { flex: 1, minWidth: 0 },
  gameTitle: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold' },
  dev: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
}));
