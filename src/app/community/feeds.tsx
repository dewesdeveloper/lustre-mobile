import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronLeft, ExternalLink, Trash2, X } from 'lucide-react-native';

import {
  deleteWorkshopItem, FEED_PAGE, getScreenshotsFeed, getWorkshopFeed,
  type FeedScreenshot, type FeedWorkshopItem,
} from '@/api/community';
import { useAdultConsent } from '@/api/adultConsent';
import { useAuth } from '@/context/AuthContext';
import { canModerate } from '@/utils/roles';
import { openExternalUrl } from '@/utils/openUrl';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type Kind = 'screenshots' | 'workshop';
type Item = FeedScreenshot | FeedWorkshopItem;

const authorName = (i: Item) => i.author?.profile?.display_name || i.author?.username || 'Игрок';

/** Общие ленты всех сообществ: скриншоты и мастерская (моды), как в лаунчере. */
export default function CommunityFeedsScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'workshop' ? 'workshop' : 'screenshots');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const adultOk = useAdultConsent();
  const { user } = useAuth();

  const load = useCallback(async (k: Kind, before?: number) => {
    setLoading(true);
    setError('');
    try {
      const page: Item[] = k === 'workshop' ? await getWorkshopFeed(before) : await getScreenshotsFeed(before);
      setItems((prev) => (before ? [...prev, ...page] : page));
      setHasMore(page.length >= FEED_PAGE);
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить ленту'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // отложенный старт: смена вкладки сбрасывает список и грузит его заново
    const t = setTimeout(() => {
      setItems([]);
      void load(kind);
    }, 0);
    return () => clearTimeout(t);
  }, [kind, load]);

  const visible = adultOk ? items : items.filter((i) => !i.community?.is_adult);
  const hiddenAdult = items.length - visible.length;

  const more = () => {
    if (!loading && hasMore && items.length) void load(kind, items[items.length - 1].ID);
  };

  const removeWorkshop = (i: FeedWorkshopItem) => {
    Alert.alert('Удалить публикацию?', `«${i.title}» исчезнет из мастерской.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkshopItem(i.ID);
            setItems((prev) => prev.filter((x) => x.ID !== i.ID));
          } catch (e) {
            Alert.alert('Не удалось удалить', apiError(e, 'Ошибка'));
          }
        },
      },
    ]);
  };

  const openCommunity = (id: number) => router.push(`/community/${id}` as Href);

  const renderItem = ({ item }: { item: Item }) => {
    if (kind === 'screenshots') {
      const s = item as FeedScreenshot;
      return (
        <View style={styles.card}>
          <Pressable onPress={() => setZoom(s.url)} accessibilityLabel="Открыть скриншот">
            <Image source={{ uri: s.url }} style={styles.shot} contentFit="cover" />
          </Pressable>
          <View style={styles.meta}>
            <Text style={styles.author} numberOfLines={1}>{authorName(s)}</Text>
            <Pressable onPress={() => openCommunity(s.community_id)} hitSlop={6} style={styles.communityLink}>
              <Text style={styles.community} numberOfLines={1}>{s.community?.name}</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    const w = item as FeedWorkshopItem;
    const canDelete = !!user && (w.author_id === user.id || canModerate(user.role));
    return (
      <View style={styles.card}>
        {w.image_url ? <Image source={{ uri: w.image_url }} style={styles.shot} contentFit="cover" /> : null}
        <View style={styles.body}>
          <Text style={styles.wTitle}>{w.title}</Text>
          {w.description ? <Text style={styles.wDesc} numberOfLines={5}>{w.description}</Text> : null}
          <View style={styles.meta}>
            <Text style={styles.author} numberOfLines={1}>{authorName(w)}</Text>
            <Pressable onPress={() => openCommunity(w.community_id)} hitSlop={6} style={styles.communityLink}>
              <Text style={styles.community} numberOfLines={1}>{w.community?.name}</Text>
            </Pressable>
          </View>
          <View style={styles.wActions}>
            <Pressable onPress={() => openExternalUrl(w.url)} style={styles.openBtn}>
              <ExternalLink size={14} color="#0b0210" />
              <Text style={styles.openText}>Открыть</Text>
            </Pressable>
            {canDelete ? (
              <Pressable onPress={() => removeWorkshop(w)} style={styles.deleteBtn} hitSlop={6}>
                <Trash2 size={14} color={L.danger} />
                <Text style={styles.deleteText}>Удалить</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.ID)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={more}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
              <ChevronLeft size={16} color={L.accent} />
              <Text style={styles.backText}>Назад</Text>
            </Pressable>
            <Text style={styles.title}>Ленты сообществ</Text>
            <View style={styles.tabs}>
              {([['screenshots', 'Скриншоты'], ['workshop', 'Мастерская']] as const).map(([id, label]) => (
                <Pressable key={id} onPress={() => setKind(id)} style={[styles.tab, kind === id && styles.tabOn]}>
                  <Text style={[styles.tabText, kind === id && styles.tabTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>{kind === 'workshop' ? 'Моды и дополнения из всех сообществ' : 'Скриншоты из всех сообществ'}</Text>
            {hiddenAdult > 0 ? <Text style={styles.hidden}>Скрыто публикаций 18+: {hiddenAdult}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>
              {kind === 'workshop' ? 'В мастерской пока пусто' : 'Пока никто не опубликовал скриншоты'}
            </Text>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator color={L.accent} style={styles.spinner} /> : null}
      />

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
          <Pressable onPress={() => setZoom(null)} style={styles.zoomClose} hitSlop={10} accessibilityLabel="Закрыть">
            <X size={20} color="#fff" />
          </Pressable>
          {zoom ? <Image source={{ uri: zoom }} style={styles.zoomImg} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  list: { padding: 16, paddingBottom: 48, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', textTransform: 'uppercase', marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, borderWidth: 1, borderColor: L.border, paddingVertical: 10, alignItems: 'center', backgroundColor: L.card },
  tabOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.14)' },
  tabText: { color: L.muted, fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  tabTextOn: { color: '#fff' },
  hint: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginBottom: 6 },
  hidden: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginBottom: 6 },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginVertical: 8 },
  empty: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', paddingVertical: 32 },
  spinner: { marginVertical: 16 },
  card: { borderWidth: 1, borderColor: L.border, backgroundColor: L.card, overflow: 'hidden' },
  shot: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#121017' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  author: { flex: 1, color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  communityLink: { maxWidth: '55%' },
  community: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
  body: { paddingTop: 10 },
  wTitle: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', paddingHorizontal: 12 },
  wDesc: { color: 'rgba(244,244,246,0.75)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18, paddingHorizontal: 12, marginTop: 6 },
  wActions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingBottom: 12 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: L.accent, paddingHorizontal: 14, height: 36 },
  openText: { color: '#0b0210', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteText: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  zoomClose: { position: 'absolute', top: 48, right: 20, padding: 8, zIndex: 2 },
  zoomImg: { width: '100%', height: '80%' },
}));
