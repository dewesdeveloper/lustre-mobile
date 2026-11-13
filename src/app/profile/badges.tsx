import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Crown, Flame, Lock } from 'lucide-react-native';

import {
  categoryLabels,
  getBadges,
  getBadgeSummary,
  rarityStyles,
  type BadgeCategory,
  type BadgeSummary,
  type BadgeWithStatus,
} from '@/api/badges';
import BadgeEmblem from '@/components/profile/BadgeEmblem';
import DataState from '@/components/ui/DataState';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';

type Filter = 'all' | BadgeCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все значки' },
  { id: 'launcher', label: 'Лаунчер' },
  { id: 'game', label: 'Игры' },
  { id: 'community', label: 'Сообщества' },
];

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function BadgesScreen() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<BadgeWithStatus[]>([]);
  const [summary, setSummary] = useState<BadgeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<BadgeWithStatus | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const list = await getBadges();
      setBadges(list);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить значки'));
    } finally {
      setLoading(false);
    }
    try {
      setSummary(await getBadgeSummary(user.id));
    } catch {
      setSummary(null);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = () => {
    setLoading(true);
    setError('');
    void load();
  };

  const filtered = useMemo(
    () => (filter === 'all' ? badges : badges.filter((b) => b.category === filter)),
    [badges, filter],
  );
  const rows = useMemo(() => chunk(filtered, 2), [filtered]);

  const earnedCount = summary?.earned ?? badges.filter((b) => b.earned).length;
  const totalBadges = summary?.total_badges ?? badges.length;
  const progress = totalBadges ? Math.round((earnedCount / totalBadges) * 100) : 0;
  const rarest = summary?.rarest || [];
  const last = summary?.last || [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Значки достижений</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* РАНГ + ПРОГРЕСС */}
        <View style={styles.panel}>
          <View style={styles.rankRow}>
            <View style={styles.rankIcon}>
              <Crown size={24} color={L.accent} />
            </View>
            <View style={styles.rankInfo}>
              <Text style={styles.kicker}>Ранг</Text>
              <Text style={styles.rankValue}>{summary?.rank || '—'}</Text>
            </View>
            <View style={styles.earnedBox}>
              <Text style={styles.kicker}>Получено</Text>
              <Text style={styles.earnedValue}>
                {earnedCount} <Text style={styles.earnedTotal}>из {totalBadges || '—'}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.trackHead}>
            <Text style={styles.trackLabel}>Прогресс коллекции</Text>
            {summary && summary.next_rank_at > 0 ? (
              <Text style={styles.trackLabel}>
                До следующего ранга — {Math.max(0, summary.next_rank_at - earnedCount)}
              </Text>
            ) : null}
          </View>

          {summary ? (
            <View style={styles.percentile}>
              <Flame size={13} color={L.accent} />
              <Text style={styles.percentileText}>
                Вы выше <Text style={styles.percentileValue}>{summary.percentile}%</Text> игроков по числу значков
              </Text>
            </View>
          ) : null}
        </View>

        {/* ТРОФЕЙНЫЙ СЧЁТ */}
        <View style={styles.panel}>
          <Text style={styles.kicker}>Трофейный счёт</Text>
          <Text style={styles.trophy}>{summary?.trophy_score ?? 0}</Text>
          <Text style={styles.hint}>Очки за редкость значков</Text>
        </View>

        {/* САМОЕ РЕДКОЕ */}
        {rarest.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>САМОЕ РЕДКОЕ</Text>
            <View style={styles.grid}>
              {chunk(rarest, 2).map((pair, ri) => (
                <View key={`rare-${ri}`} style={styles.gridRow}>
                  {pair.map((it) => {
                    const r = rarityStyles[it.badge.rarity] || rarityStyles.common;
                    return (
                      <View key={it.badge.id} style={[styles.card, styles.cardCommon, { borderColor: r.border }]}>
                        <BadgeEmblem code={it.badge.code} rarity={it.badge.rarity} size={52} />
                        <Text style={styles.cardName} numberOfLines={2}>
                          {it.badge.name}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {r.label} · есть у {it.holders_percent}%
                        </Text>
                      </View>
                    );
                  })}
                  {pair.length === 1 ? <View style={styles.cardSpacer} /> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ПОСЛЕДНЕЕ ПОЛУЧЕННОЕ */}
        {last.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>ПОСЛЕДНЕЕ ПОЛУЧЕННОЕ</Text>
            <View style={styles.panel}>
              {last.map((it, i) => (
                <View key={it.badge.id} style={[styles.lastRow, i > 0 && styles.lastRowBorder]}>
                  <BadgeEmblem code={it.badge.code} rarity={it.badge.rarity} size={40} />
                  <View style={styles.lastInfo}>
                    <Text style={styles.lastName} numberOfLines={1}>
                      {it.badge.name}
                    </Text>
                    <Text style={styles.lastDate}>{fmtDate(it.awarded_at)}</Text>
                  </View>
                  <Text style={styles.lastPercent}>есть у {it.holders_percent}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ФИЛЬТРЫ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.filterBtn, active && styles.filterBtnActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* КАТАЛОГ */}
        {loading || error ? (
          <DataState loading={loading} error={error} onRetry={retry} />
        ) : filtered.length === 0 ? (
          <DataState empty emptyText="В этой категории пока нет значков" />
        ) : (
          <View style={styles.grid}>
            {rows.map((pair, ri) => (
              <View key={`row-${ri}`} style={styles.gridRow}>
                {pair.map((badge) => {
                  const r = rarityStyles[badge.rarity] || rarityStyles.common;
                  const hidden = badge.secret && !badge.earned;
                  return (
                    <Pressable
                      key={badge.id}
                      onPress={() => setSelected(badge)}
                      style={[
                        styles.card,
                        badge.earned ? { borderColor: r.border, backgroundColor: r.bg } : styles.cardLocked,
                      ]}>
                      <View style={styles.cardTop}>
                        <BadgeEmblem code={badge.code} rarity={badge.rarity} size={56} dim={!badge.earned} />
                        {!badge.earned ? (
                          <View style={styles.lock}>
                            <Lock size={11} color={L.muted} />
                          </View>
                        ) : null}
                      </View>

                      <Text style={[styles.cardName, !badge.earned && styles.cardNameLocked]} numberOfLines={2}>
                        {badge.name}
                      </Text>

                      <View style={styles.chips}>
                        <Text style={[styles.chip, { color: r.color, borderColor: r.border, backgroundColor: r.bg }]}>
                          {r.label}
                        </Text>
                        <Text style={styles.chipMuted}>{categoryLabels[badge.category]}</Text>
                      </View>

                      <Text style={styles.cardDesc} numberOfLines={3}>
                        {badge.description}
                      </Text>

                      <View style={styles.cardFoot}>
                        {!hidden && typeof badge.holders_percent === 'number' ? (
                          <Text style={styles.footText}>есть у {badge.holders_percent}%</Text>
                        ) : (
                          <Text style={styles.footText}>{'\u2003'}</Text>
                        )}
                        {badge.earned && badge.awarded_at ? (
                          <Text style={styles.footEarned}>получен {fmtDate(badge.awarded_at)}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                {pair.length === 1 ? <View style={styles.cardSpacer} /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ДЕТАЛЬНАЯ КАРТОЧКА ЗНАЧКА */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selected ? (
              <View style={styles.modalBody}>
                <BadgeEmblem code={selected.code} rarity={selected.rarity} size={84} dim={!selected.earned} />
                <Text style={styles.modalName}>{selected.name}</Text>
                <View style={styles.chips}>
                  <Text
                    style={[
                      styles.chip,
                      {
                        color: (rarityStyles[selected.rarity] || rarityStyles.common).color,
                        borderColor: (rarityStyles[selected.rarity] || rarityStyles.common).border,
                        backgroundColor: (rarityStyles[selected.rarity] || rarityStyles.common).bg,
                      },
                    ]}>
                    {(rarityStyles[selected.rarity] || rarityStyles.common).label}
                  </Text>
                  <Text style={styles.chipMuted}>{categoryLabels[selected.category]}</Text>
                </View>
                <Text style={styles.modalDesc}>{selected.description}</Text>
                {!selected.secret || selected.earned ? (
                  typeof selected.holders_percent === 'number' ? (
                    <Text style={styles.modalMeta}>Есть у {selected.holders_percent}% игроков</Text>
                  ) : null
                ) : (
                  <Text style={styles.modalMeta}>Секретный значок — условие пока неизвестно</Text>
                )}
                {selected.earned && selected.awarded_at ? (
                  <Text style={styles.modalEarned}>Получен {fmtDate(selected.awarded_at)}</Text>
                ) : (
                  <Text style={styles.modalLocked}>Ещё не получен</Text>
                )}
                <Pressable style={styles.modalClose} onPress={() => setSelected(null)}>
                  <Text style={styles.modalCloseText}>Закрыть</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingTop: 4, paddingBottom: 48 },

  panel: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    marginBottom: 14,
  },
  kicker: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2 },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rankIcon: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: L.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankInfo: { flex: 1, minWidth: 0 },
  rankValue: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', textTransform: 'uppercase', marginTop: 4 },
  earnedBox: { alignItems: 'flex-end' },
  earnedValue: { color: L.accent, fontSize: 20, fontFamily: 'Tiny5', marginTop: 4 },
  earnedTotal: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },

  track: {
    height: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 14,
  },
  fill: { height: '100%', backgroundColor: L.accent },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  trackLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  percentile: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  percentileText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  percentileValue: { color: L.accent, fontWeight: '900' },

  trophy: { color: L.accent, fontSize: 34, fontFamily: 'Tiny5', marginTop: 6 },
  hint: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },

  block: { marginBottom: 6 },
  blockTitle: {
    color: L.muted,
    fontSize: 10, fontFamily: 'Tiny5',
    letterSpacing: 2,
    marginBottom: 10,
  },

  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
    backgroundColor: L.card,
  },
  cardCommon: { backgroundColor: L.card },
  cardLocked: { opacity: 0.7 },
  cardSpacer: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  lock: {
    width: 24,
    height: 24,
    borderRadius: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: L.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { color: L.text, fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', lineHeight: 16 },
  cardNameLocked: { color: L.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 8 },
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
  chipMuted: {
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: L.border,
    color: L.muted,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  cardDesc: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17 },
  cardMeta: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
  },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  footText: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  footEarned: { color: L.success, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  lastRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,0,110,0.12)' },
  lastInfo: { flex: 1, minWidth: 0 },
  lastName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase' },
  lastDate: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  lastPercent: { color: L.accent, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },

  filterScroll: { marginBottom: 14, marginHorizontal: -4 },
  filterRow: { gap: 8, paddingHorizontal: 4 },
  filterBtn: {
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.card,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterBtnActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.12)' },
  filterText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  filterTextActive: { color: L.accent },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    overflow: 'hidden',
  },
  modalBody: { alignItems: 'center', padding: 24, gap: 4 },
  modalName: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', textTransform: 'uppercase', textAlign: 'center', marginTop: 12 },
  modalDesc: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, textAlign: 'center', marginTop: 4 },
  modalMeta: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10 },
  modalEarned: { color: L.success, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', marginTop: 4 },
  modalLocked: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
  modalClose: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingHorizontal: 24,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalCloseText: {
    color: L.text,
    fontSize: 12, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
}));
