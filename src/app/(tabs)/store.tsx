import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';

import { answerAdultOffer, useAdultConsent } from '@/api/adultConsent';
import api from '@/api/client';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type GameTag = { id: number; name: string };
type GameLang = { id: number; name: string };

type Game = {
  ID: number;
  title: string;
  developer?: string;
  publisher?: string;
  release_date?: string;
  header_image?: string;
  banner_url?: string;
  age_rating?: string;
  is_adult?: boolean;
  tags?: GameTag[];
  languages?: GameLang[];
};

type SortKey = 'title-asc' | 'title-desc' | 'date-new' | 'date-old' | 'added-new' | 'added-old';

const AGE_RATINGS = ['3+', '7+', '10+', '12+', '16+', '18+'];

const QUICK_NAV = [
  { label: 'Новости', path: '/store/news' },
  { label: 'Рекомендации', path: '/store/recommendations' },
  { label: 'Загрузки', path: '/store/downloads' },
  { label: 'Сообщества', path: '/community' },
] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'added-new', label: 'Сначала новые' },
  { value: 'added-old', label: 'Сначала старые' },
  { value: 'title-asc', label: 'А → Я' },
  { value: 'title-desc', label: 'Я → А' },
  { value: 'date-new', label: 'Дата выхода ↓' },
  { value: 'date-old', label: 'Дата выхода ↑' },
];

function gamesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'игра';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'игры';
  return 'игр';
}

export default function StoreScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagCategory, setTagCategory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('added-new');
  const [hideAdult, setHideAdult] = useState(false);
  const adultConsent = useAdultConsent();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const PAGE = 24;
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');

  // Поиск уходит на сервер с задержкой — не дёргаем бэк на каждую букву
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  /** Подгрузка страницы каталога. reset=true — начать заново (новый фильтр/фокус). */
  const loadPage = useCallback(
    async (reset: boolean) => {
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
        const params: Record<string, unknown> = { limit: PAGE, offset, sort: sortBy };
        if (debouncedQ) params.q = debouncedQ;
        if (selectedRating) params.age = selectedRating;
        if (selectedTags.length) params.tags = selectedTags.join(',');
        if (selectedLang) params.lang = selectedLang;
        if (hideAdult || !adultConsent) params.adult = '0';

        const res = await api.get('/games/', { params });
        const chunk = Array.isArray(res.data) ? (res.data as Game[]) : [];
        const count = Number(res.headers?.['x-total-count']) || chunk.length;
        setTotal(count);
        setGames((prev) => (reset ? chunk : [...prev, ...chunk]));
        offsetRef.current = offset + chunk.length;
        hasMoreRef.current = chunk.length === PAGE && offset + chunk.length < count;
      } catch (e) {
        if (reset) setError(apiError(e, 'Не удалось загрузить игры'));
      } finally {
        if (reset) {
          setLoading(false);
        } else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [sortBy, debouncedQ, selectedRating, selectedTags, selectedLang, hideAdult, adultConsent],
  );

  // Список тегов — один раз при монтировании
  useEffect(() => {
    let alive = true;
    api
      .get('/tags/')
      .then((r) => {
        if (!alive) return;
        const tags = Array.isArray(r.data) ? (r.data as { name: string; category?: string }[]) : [];
        setAllTags(tags.map((t) => t.name));
        const map: Record<string, string> = {};
        tags.forEach((t) => {
          map[t.name] = t.category || 'regular';
        });
        setTagCategory(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Первая загрузка + перезагрузка при смене фильтров (loadPage пересоздаётся)
  useFocusEffect(
    useCallback(() => {
      void loadPage(true);
    }, [loadPage]),
  );

  const allLanguages = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => g.languages?.forEach((l) => set.add(l.name)));
    return Array.from(set).sort();
  }, [games]);

  const isAdultTag = useCallback((tag: string) => (tagCategory[tag] || 'regular') === 'adult', [tagCategory]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const clearFilters = () => {
    setQ('');
    setSelectedRating('');
    setSelectedTags([]);
    setSelectedLang('');
    setSortBy('added-new');
    setHideAdult(false);
  };

  const hasFilters = !!(q || selectedRating || selectedTags.length || selectedLang || hideAdult);

  // Фильтрация/сортировка выполняются на сервере (см. loadPage) — здесь только загруженные страницы
  const filtered = games;

  const visibleTags = useMemo(() => {
    const term = tagSearch.trim().toLowerCase();
    return allTags.filter((t) => {
      if (!term) return true;
      return t.toLowerCase().includes(term);
    });
  }, [allTags, tagSearch]);

  const filterCount =
    (selectedRating ? 1 : 0) + selectedTags.length + (selectedLang ? 1 : 0) + (hideAdult ? 1 : 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Магазин</Text>

        {/* Быстрый переход по разделам витрины */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {QUICK_NAV.map((nav) => (
            <Chip
              key={nav.path}
              label={nav.label}
              active={false}
              onPress={() => router.push(nav.path as Href)}
            />
          ))}
        </ScrollView>

        {/* Поиск + фильтры */}
        <View style={styles.searchRow}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Поиск игр..."
            placeholderTextColor={L.muted}
            style={styles.search}
          />
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={({ pressed }) => [styles.filterBtn, filterCount > 0 && styles.filterBtnActive, pressed && styles.pressed]}>
            <Text style={[styles.filterBtnText, filterCount > 0 && styles.filterBtnTextActive]}>
              Фильтры{filterCount > 0 ? ` · ${filterCount}` : ''}
            </Text>
          </Pressable>
        </View>

        {/* Сортировка */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORT_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} active={sortBy === opt.value} onPress={() => setSortBy(opt.value)} />
          ))}
        </ScrollView>

        {!adultConsent && (
          <View style={styles.adultRow}>
            <Text style={styles.adultRowText} numberOfLines={2}>Игры 18+ скрыты</Text>
            <Pressable
              onPress={() =>
                Alert.alert('Показывать игры 18+?', 'Подтвердите, что вам есть 18 лет.', [
                  { text: 'Отмена', style: 'cancel' },
                  { text: 'Мне есть 18', onPress: () => answerAdultOffer(true) },
                ])
              }
              hitSlop={8}>
              <Text style={styles.adultRowAction}>Показать</Text>
            </Pressable>
          </View>
        )}

        {/* Активные фильтры */}
        {hasFilters && (
          <View style={styles.activeRow}>
            {selectedRating ? <ActiveChip label={selectedRating} onRemove={() => setSelectedRating('')} /> : null}
            {selectedTags.map((t) => (
              <ActiveChip key={t} label={t} onRemove={() => toggleTag(t)} />
            ))}
            {selectedLang ? <ActiveChip label={selectedLang} onRemove={() => setSelectedLang('')} /> : null}
            {hideAdult ? <ActiveChip label="Без 18+" onRemove={() => setHideAdult(false)} /> : null}
            <Pressable onPress={clearFilters} hitSlop={6}>
              <Text style={styles.clearAll}>Сбросить</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.count}>
          {total} {gamesWord(total)} найдено
        </Text>
      </View>

      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={() => { void loadPage(true); }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.ID)}
          contentContainerStyle={styles.list}
          onEndReached={() => { void loadPage(false); }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={L.accent} style={{ marginVertical: 18 }} /> : null
          }
          ListEmptyComponent={
            <DataState
              empty
              emptyText={games.length ? 'Нет игр по вашим фильтрам' : 'В каталоге пока нет игр'}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/game/${item.ID}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              {item.header_image || item.banner_url ? (
                <Image
                  source={{ uri: item.header_image || item.banner_url }}
                  style={styles.banner}
                  cachePolicy="memory-disk"
                  transition={200}
                  priority="normal"
                />
              ) : null}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.metaRow}>
                  {item.developer ? <Text style={styles.dev} numberOfLines={1}>{item.developer}</Text> : null}
                  {item.age_rating ? <Text style={styles.age}>{item.age_rating}</Text> : null}
                  {item.is_adult ? <Text style={styles.adult}>18+</Text> : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* ===== Шторка фильтров ===== */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFiltersOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Фильтры</Text>
              <Pressable onPress={clearFilters} hitSlop={8}>
                <Text style={styles.clearAll}>Очистить</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Возрастной рейтинг */}
              <Text style={styles.sectionLabel}>Возрастной рейтинг</Text>
              <View style={styles.wrap}>
                {AGE_RATINGS.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    active={selectedRating === r}
                    onPress={() => setSelectedRating((prev) => (prev === r ? '' : r))}
                  />
                ))}
              </View>

              {/* Скрыть 18+ */}
              <Pressable style={styles.toggleRow} onPress={() => setHideAdult((v) => !v)}>
                <View style={[styles.checkbox, hideAdult && styles.checkboxOn]}>
                  {hideAdult ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.toggleText}>Скрывать игры для взрослых (18+)</Text>
              </Pressable>

              {/* Теги */}
              {allTags.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Теги</Text>
                  <TextInput
                    value={tagSearch}
                    onChangeText={setTagSearch}
                    placeholder="Поиск тегов..."
                    placeholderTextColor={L.muted}
                    style={styles.tagSearch}
                  />
                  <View style={styles.wrap}>
                    {visibleTags.map((t) => {
                      const adult = isAdultTag(t);
                      if (hideAdult && adult) return null;
                      return (
                        <Chip
                          key={t}
                          label={t}
                          active={selectedTags.includes(t)}
                          adult={adult}
                          onPress={() => toggleTag(t)}
                        />
                      );
                    })}
                    {visibleTags.length === 0 ? <Text style={styles.dim}>Ничего не найдено</Text> : null}
                  </View>
                </>
              )}

              {/* Язык */}
              {allLanguages.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Язык</Text>
                  <View style={styles.wrap}>
                    <Chip label="Все языки" active={!selectedLang} onPress={() => setSelectedLang('')} />
                    {allLanguages.map((l) => (
                      <Chip
                        key={l}
                        label={l}
                        active={selectedLang === l}
                        onPress={() => setSelectedLang((prev) => (prev === l ? '' : l))}
                      />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable style={[styles.applyBtn]} onPress={() => setFiltersOpen(false)}>
                <Text style={styles.applyText}>Показать {total}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  adult,
  onPress,
}: {
  label: string;
  active: boolean;
  adult?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        adult && !active && styles.chipAdult,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable onPress={onRemove} style={styles.activeChip}>
      <Text style={styles.activeChipText}>{label}</Text>
      <Text style={styles.activeChipX}>×</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  adultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: L.border },
  adultRowText: { flex: 1, color: 'rgba(226,226,226,0.8)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  adultRowAction: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  header: { paddingHorizontal: 16, paddingTop: 20 },
  title: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 1, marginBottom: 12 },

  searchRow: { flexDirection: 'row', gap: 10 },
  search: {
    flex: 1,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: L.text,
    fontSize: 14, fontFamily: 'JetBrainsMono_400Regular',
  },
  filterBtn: { borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 14, justifyContent: 'center' },
  filterBtnActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.14)' },
  filterBtnText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  filterBtnTextActive: { color: '#fff' },

  chipRow: { gap: 8, paddingVertical: 12 },
  chip: { borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: L.card },
  chipActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.16)' },
  chipAdult: { borderColor: 'rgba(255,0,60,0.45)' },
  chipText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  chipTextActive: { color: '#fff' },

  activeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, paddingHorizontal: 10, paddingVertical: 5 },
  activeChipText: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  activeChipX: { color: L.accent, fontSize: 13, fontFamily: 'Tiny5', },
  clearAll: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, paddingVertical: 5 },

  count: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  list: { padding: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, overflow: 'hidden' },
  pressed: { opacity: 0.8 },
  banner: { width: '100%', height: 150, backgroundColor: '#000' },
  cardBody: { padding: 14 },
  cardTitle: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dev: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', flex: 1 },
  age: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', backgroundColor: L.cardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0 },
  adult: { color: L.danger, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', borderWidth: 1, borderColor: `${L.danger}66`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: L.bg, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 1, borderColor: L.borderStrong, maxHeight: '85%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  sheetTitle: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', letterSpacing: 1 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  sectionLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2, marginTop: 12, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dim: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  tagSearch: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: L.text,
    fontSize: 13, fontFamily: 'JetBrainsMono_400Regular',
    marginBottom: 10,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 0, borderWidth: 1.5, borderColor: L.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: L.accent, borderColor: L.accent },
  checkboxMark: { color: '#fff', fontSize: 13, fontFamily: 'Tiny5', },
  toggleText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderColor: L.border },
  applyBtn: { backgroundColor: L.accent, borderRadius: 0, paddingVertical: 14, alignItems: 'center' },
  applyText: { color: '#fff', fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
}));
