import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { ChevronLeft, Meh, ShieldAlert, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react-native';

import {
  getModerationFeed, getModerationLog, moderateDelete,
  type ModerationItem, type ModerationLogEntry, type ModerationType,
} from '@/api/moderation';
import { useAuth } from '@/context/AuthContext';
import { canModerate } from '@/utils/roles';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

const TYPE_LABEL: Record<ModerationType, string> = {
  comment: 'Комментарий в профиле',
  game_comment: 'Комментарий к игре',
  game_review: 'Отзыв',
  community_post: 'Обсуждение',
  community_post_comment: 'Ответ в обсуждении',
  community_image: 'Изображение',
  community_workshop: 'Мастерская',
  voice_message: 'Чат голосового канала',
  community: 'Сообщество',
};

const TABS: [ModerationType | 'all', string][] = [
  ['all', 'Всё'],
  ['comment', 'Профили'],
  ['game_comment', 'Комментарии к играм'],
  ['game_review', 'Отзывы'],
  ['community_post', 'Обсуждения'],
  ['community_post_comment', 'Ответы'],
  ['community_image', 'Изображения'],
  ['community_workshop', 'Мастерская'],
  ['voice_message', 'Чаты каналов'],
  ['community', 'Сообщества'],
];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Куда ведёт карточка: место, где лежит контент (маршруты мобильного приложения). */
function contextLink(it: ModerationItem): string | null {
  if (it.type === 'community_post') return `/community/post/${it.id}`;
  switch (it.context_type) {
    case 'profile': return it.context_ref ? `/profile/${it.context_ref}` : null;
    case 'game': return `/game/${it.context_id}`;
    case 'community': return `/community/${it.context_id}`;
    case 'post': return `/community/post/${it.context_id}`;
  }
  return null;
}

/**
 * Модерация контента (как в лаунчере): лента свежих комментариев, отзывов, обсуждений,
 * изображений и сообществ с удалением, плюс журнал удалений. Доступ — moderator, manager, admin.
 */
export default function ModerationScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<'feed' | 'log'>('feed');
  const [type, setType] = useState<ModerationType | 'all'>('all');

  if (!canModerate(user?.role)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.denied}>
          <ShieldAlert size={22} color={L.accent} />
          <Text style={styles.deniedText}>Раздел доступен только модераторам.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={16} color={L.accent} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Модерация</Text>
        <View style={styles.tabs}>
          {([['feed', 'Контент'], ['log', 'Журнал']] as const).map(([id, label]) => (
            <Pressable key={id} onPress={() => setView(id)} style={[styles.tab, view === id && styles.tabOn]}>
              <Text style={[styles.tabText, view === id && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {view === 'feed' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {TABS.map(([id, label]) => (
              <Pressable key={id} onPress={() => setType(id)} style={[styles.chip, type === id && styles.chipOn]}>
                <Text style={[styles.chipText, type === id && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      {view === 'feed' ? <Feed key={type} type={type} /> : <Log />}
    </SafeAreaView>
  );
}

function Feed({ type }: { type: ModerationType | 'all' }) {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    setError('');
    try {
      const page = await getModerationFeed(type, before);
      setItems((prev) => (before ? [...prev, ...page.items] : page.items));
      setNext(page.next_before);
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить контент'));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const remove = (it: ModerationItem) => {
    const what = TYPE_LABEL[it.type].toLowerCase();
    Alert.alert('Удалить?', `${what[0].toUpperCase()}${what.slice(1)} будет удалён(о) без возможности восстановления.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await moderateDelete(it.type, it.id);
            setItems((prev) => prev.filter((x) => !(x.type === it.type && x.id === it.id)));
          } catch (e) {
            Alert.alert('Не удалось удалить', apiError(e, 'Ошибка'));
          }
        },
      },
    ]);
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => `${it.type}:${it.id}`}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <ItemCard it={item} onDelete={() => remove(item)} />}
      onEndReached={() => { if (next && !loading) void load(next); }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={loading ? null : <Text style={styles.empty}>Нового контента нет.</Text>}
      ListFooterComponent={loading ? <ActivityIndicator color={L.accent} style={styles.spinner} /> : null}
    />
  );
}

function ItemCard({ it, onDelete }: { it: ModerationItem; onDelete: () => void }) {
  const name = it.author?.profile?.display_name || it.author?.username || 'Пользователь';
  const link = contextLink(it);
  const where = it.type === 'community' ? '' : it.context_name;
  const go = (href: string | null) => { if (href) router.push(href as Href); };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Pressable onPress={() => go(it.author?.username ? `/profile/${it.author.username}` : null)} style={styles.flex}>
          <Text style={styles.author} numberOfLines={1}>{name}</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={6} accessibilityLabel="Удалить">
          <Trash2 size={14} color={L.danger} />
          <Text style={styles.deleteText}>Удалить</Text>
        </Pressable>
      </View>
      <View style={styles.badges}>
        <Text style={styles.chipStatic}>{TYPE_LABEL[it.type]}</Text>
        {it.type === 'game_review' ? (
          it.neutral ? (
            <View style={styles.rating}><Meh size={12} color={L.neutral} /><Text style={[styles.ratingText, { color: L.neutral }]}>Нейтральный</Text></View>
          ) : (
            <View style={styles.rating}>
              {it.positive ? <ThumbsUp size={12} color={L.success} /> : <ThumbsDown size={12} color={L.danger} />}
              <Text style={[styles.ratingText, { color: it.positive ? L.success : L.danger }]}>{it.positive ? 'Рекомендует' : 'Не рекомендует'}</Text>
            </View>
          )
        ) : null}
        <Text style={styles.date}>{fmt(it.created_at)}</Text>
      </View>
      {where ? (
        <Pressable onPress={() => go(link)} disabled={!link}>
          <Text style={[styles.where, link && styles.whereLink]} numberOfLines={1}>{where}</Text>
        </Pressable>
      ) : null}
      {it.title ? <Text style={styles.itemTitle}>{it.title}</Text> : null}
      {it.content ? <Text style={styles.content}>{it.content}</Text> : null}
      {it.image_url ? <Image source={{ uri: it.image_url }} style={styles.image} contentFit="contain" /> : null}
    </View>
  );
}

function Log() {
  const [rows, setRows] = useState<ModerationLogEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getModerationLog().then(setRows).catch((e) => setError(apiError(e, 'Не удалось загрузить журнал')));
  }, []);

  if (error) return <Text style={[styles.error, styles.pad]}>{error}</Text>;
  if (!rows) return <ActivityIndicator color={L.accent} style={styles.spinner} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>Удалений пока не было.</Text>}
      renderItem={({ item: r }) => {
        let content = '';
        try { content = JSON.parse(r.meta || '{}').content || ''; } catch { /* старая запись */ }
        return (
          <View style={styles.card}>
            <View style={styles.badges}>
              <Text style={styles.author}>{r.username || `#${r.user_id}`}</Text>
              <Text style={styles.date}>удалил(а)</Text>
              <Text style={styles.chipStatic}>{TYPE_LABEL[r.target_type] || r.target_type}</Text>
            </View>
            {r.target_name ? <Text style={styles.itemTitle}>«{r.target_name}»</Text> : null}
            {content ? <Text style={styles.content}>{content}</Text> : null}
            <Text style={styles.date}>{fmt(r.created_at)}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  head: { paddingHorizontal: 16, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', textTransform: 'uppercase', marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, borderWidth: 1, borderColor: L.border, paddingVertical: 10, alignItems: 'center', backgroundColor: L.card },
  tabOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.14)' },
  tabText: { color: L.muted, fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  tabTextOn: { color: '#fff' },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { borderWidth: 1, borderColor: L.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: L.card },
  chipOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.16)' },
  chipText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  chipTextOn: { color: '#fff' },
  list: { padding: 16, paddingTop: 4, paddingBottom: 48, gap: 10 },
  card: { borderWidth: 1, borderColor: L.border, backgroundColor: L.card, padding: 12, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  author: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,77,79,0.4)', paddingHorizontal: 10, paddingVertical: 6 },
  deleteText: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chipStatic: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', borderWidth: 1, borderColor: 'rgba(255,0,110,0.4)', paddingHorizontal: 6, paddingVertical: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  date: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  where: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  whereLink: { textDecorationLine: 'underline' },
  itemTitle: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold' },
  content: { color: 'rgba(244,244,246,0.85)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  image: { width: '100%', height: 200, backgroundColor: '#000', borderWidth: 1, borderColor: L.border },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginBottom: 8 },
  pad: { padding: 16 },
  empty: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', paddingVertical: 32 },
  spinner: { marginVertical: 20 },
  denied: { margin: 16, padding: 16, borderWidth: 1, borderColor: L.border, backgroundColor: L.card, flexDirection: 'row', alignItems: 'center', gap: 10 },
  deniedText: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', flex: 1 },
}));
