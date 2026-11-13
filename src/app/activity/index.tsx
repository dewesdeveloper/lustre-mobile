import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';

import {
  fetchActivityFeed,
  type ActivityItem,
  type ActivityKind,
} from '@/api/activity';
import { rarityStyles, type BadgeRarity } from '@/api/badges';
import BadgeEmblem from '@/components/profile/BadgeEmblem';
import DataState from '@/components/ui/DataState';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';

const KIND_META: Record<ActivityKind, { label: string; verb: string; color: string }> = {
  library_add: { label: 'Библиотека', verb: 'добавил(а) в библиотеку', color: L.accent },
  favorite: { label: 'Избранное', verb: 'добавил(а) в избранное', color: '#fb7185' },
  badge_earned: { label: 'Значки', verb: 'получил(а) значок', color: '#fbbf24' },
  comment: { label: 'Стена', verb: 'оставил(а) комментарий', color: '#a78bfa' },
  follow: { label: 'Подписки', verb: 'подписался(ась) на', color: '#38bdf8' },
  group: { label: 'Группы', verb: 'создал(а) группу', color: '#34d399' },
  review: { label: 'Отзывы', verb: 'оставил(а) отзыв', color: '#facc15' },
  title_equip: { label: 'Титулы', verb: 'надел(а) титул', color: '#c084fc' },
  level_up: { label: 'Уровни', verb: 'вышел(а) на уровень', color: '#fcd34d' },
};

const FILTERS: { id: ActivityKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'library_add', label: 'Библиотека' },
  { id: 'favorite', label: 'Избранное' },
  { id: 'badge_earned', label: 'Значки' },
  { id: 'comment', label: 'Стена' },
  { id: 'follow', label: 'Подписки' },
  { id: 'group', label: 'Группы' },
  { id: 'review', label: 'Отзывы' },
  { id: 'level_up', label: 'Уровни' },
];

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Сегодня';
  if (dayKey(iso) === dayKey(yest.toISOString())) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Куда ведёт цель события (игры и профили). */
function targetHref(item: ActivityItem): string | null {
  if (item.kind === 'library_add' || item.kind === 'favorite' || item.kind === 'review') {
    return item.target_id ? `/game/${item.target_id}` : null;
  }
  if (item.kind === 'badge_earned') return '/profile/badges';
  // у подписок бэкенд отдаёт отображаемое имя — ссылаемся только на «чистые» ники
  if (item.kind === 'follow' && item.target_name && /^[A-Za-z0-9_]+$/.test(item.target_name)) {
    return `/profile/${item.target_name}`;
  }
  return null;
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Partial<Record<ActivityKind, number>>>({});
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');

  const total7d = useMemo(
    () => Object.values(summary).reduce((a, b) => a + (Number(b) || 0), 0),
    [summary],
  );

  const actorName = user?.profile?.display_name || user?.username || '';
  const actorAvatar = user?.profile?.avatar_url || '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Лента <Text style={styles.titleAccent}>активности</Text>
          </Text>
          <Text style={styles.subtitle}>
            {actorName} · {total7d} событий за 7 дней
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.id !== 'all' ? summary[f.id] : undefined;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterBtn, active && styles.filterBtnActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
                {count ? <Text style={styles.filterCount}> {count}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ActivityFeed key={filter} filter={filter} actorName={actorName} actorAvatar={actorAvatar} isPro={!!user?.profile?.is_pro} onSummary={setSummary} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityFeed({
  filter,
  actorName,
  actorAvatar,
  isPro,
  onSummary,
}: {
  filter: ActivityKind | 'all';
  actorName: string;
  actorAvatar: string;
  isPro: boolean;
  onSummary: (s: Partial<Record<ActivityKind, number>>) => void;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (before?: number) => {
      const data = await fetchActivityFeed({ limit: 25, before, kind: filter });
      setItems((prev) => (before ? [...prev, ...data.items] : data.items));
      onSummary(data.summary_7d || {});
      setCursor(data.next_before || 0);
      setHasMore(!!data.has_more);
      setError('');
      setLoading(false);
      return data;
    },
    [filter, onSummary],
  );

  useFocusEffect(
    useCallback(() => {
      fetchPage().catch((e) => setError(apiError(e, 'Не удалось загрузить активность')));
    }, [fetchPage]),
  );

  const retry = useCallback(() => {
    setLoading(true);
    setError('');
    fetchPage()
      .catch((e) => setError(apiError(e, 'Не удалось загрузить активность')))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(cursor);
    } catch {
      // оставляем текущую ленту
    } finally {
      setLoadingMore(false);
    }
  };

  const grouped = useMemo(() => {
    const out: { key: string; label: string; rows: ActivityItem[] }[] = [];
    for (const it of items) {
      const key = dayKey(it.created_at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(it);
      else out.push({ key, label: dayLabel(it.created_at), rows: [it] });
    }
    return out;
  }, [items]);

  if (loading || error) {
    return <DataState loading={loading} error={error} onRetry={retry} />;
  }
  if (items.length === 0) {
    return (
      <DataState
        empty
        emptyText="Пока нет активности. Добавь игру в библиотеку, поставь лайк или получи значок."
      />
    );
  }

  return (
    <>
      {grouped.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          {group.rows.map((item) => (
            <Row
              key={item.id}
              item={item}
              actorName={actorName}
              actorAvatar={actorAvatar}
              isPro={isPro}
            />
          ))}
        </View>
      ))}

      {hasMore ? (
        <Pressable onPress={() => void loadMore()} disabled={loadingMore} style={styles.moreBtn}>
          {loadingMore ? (
            <ActivityIndicator color={L.muted} />
          ) : (
            <Text style={styles.moreText}>Показать ещё</Text>
          )}
        </Pressable>
      ) : null}
    </>
  );
}

function Row({
  item,
  actorName,
  actorAvatar,
  isPro,
}: {
  item: ActivityItem;
  actorName: string;
  actorAvatar: string;
  isPro: boolean;
}) {
  const meta = KIND_META[item.kind] || KIND_META.library_add;
  const isBadge = item.kind === 'badge_earned';
  const rarity = (item.meta?.rarity as BadgeRarity) || 'common';
  const rStyle = rarityStyles[rarity] || rarityStyles.common;
  const href = targetHref(item);

  const openTarget = () => {
    if (href) router.push(href as Href);
  };

  return (
    <View style={styles.row}>
      {actorAvatar ? (
        <Image source={{ uri: actorAvatar }} style={styles.actor} />
      ) : (
        <View style={[styles.actor, styles.actorFallback]}>
          <Text style={styles.actorFallbackText}>{(actorName || '?')[0]?.toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Text style={styles.rowText}>
          <Text style={styles.rowActor}>
            {isPro ? <Text style={styles.pro}>PRO </Text> : null}
            {actorName}
          </Text>{' '}
          <Text style={{ color: meta.color }}>{meta.verb}</Text>{' '}
          {item.target_name ? (
            href ? (
              <Text style={styles.rowTarget} onPress={openTarget}>
                {item.target_name}
              </Text>
            ) : (
              <Text style={styles.rowTargetPlain}>{item.target_name}</Text>
            )
          ) : null}
        </Text>

        {item.meta?.excerpt ? (
          <Text style={styles.rowExcerpt} numberOfLines={1}>
            {item.meta.excerpt}
          </Text>
        ) : null}

        {isBadge || (item.kind === 'review' && item.meta?.positive !== undefined) ? (
          <View style={styles.chips}>
            {isBadge ? (
              <View style={styles.chipInline}>
                <BadgeEmblem code={item.meta?.code || 'unknown'} rarity={rarity} size={22} />
                <Text style={[styles.chip, { color: rStyle.color, borderColor: rStyle.border, backgroundColor: rStyle.bg }]}>
                  {rStyle.label}
                </Text>
              </View>
            ) : null}
            {item.kind === 'review' && item.meta?.positive !== undefined ? (
              <Text style={[styles.reviewChip, { color: item.meta.neutral ? L.neutral : item.meta.positive ? L.success : '#fb7185' }]}>
                {item.meta.neutral ? 'смешанные впечатления' : item.meta.positive ? 'нравится' : 'не нравится'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={styles.time}>{ago(item.created_at)}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  headerText: { flex: 1 },
  title: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', textTransform: 'uppercase' },
  titleAccent: { color: L.accent },
  subtitle: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 3 },

  filterScroll: { maxHeight: 56, marginTop: 10, marginBottom: 4 },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  filterBtn: {
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.card,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterBtnActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.12)' },
  filterText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  filterTextActive: { color: L.accent },
  filterCount: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },

  content: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 6 },

  group: { marginBottom: 20 },
  groupTitle: {
    color: L.muted,
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
    marginBottom: 8,
  },
  actor: { width: 40, height: 40, borderRadius: 0, backgroundColor: L.cardAlt },
  actorFallback: { alignItems: 'center', justifyContent: 'center' },
  actorFallbackText: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', },
  rowBody: { flex: 1, minWidth: 0 },
  rowText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  rowActor: { color: L.text, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowTarget: { color: L.text, fontWeight: '800' },
  rowTargetPlain: { color: L.text, fontWeight: '800' },
  rowExcerpt: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  chipInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  reviewChip: { fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  pro: {
    color: '#0b0210',
    backgroundColor: L.accent,
    fontSize: 10, fontFamily: 'Tiny5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  time: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', alignSelf: 'flex-start' },

  moreBtn: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  moreText: {
    color: L.muted,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
}));
