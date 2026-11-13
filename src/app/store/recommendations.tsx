import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import {
  ChevronRight,
  Gamepad2,
  Heart,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Users,
} from 'lucide-react-native';

import {
  getRecommendationsFull,
  type RecGame,
  type RecItem,
  type Recommendations,
} from '@/api/recommendations';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

const SOURCES: { id: string; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'reviews', label: 'Отзывы' },
  { id: 'favorites', label: 'Избранное' },
  { id: 'library', label: 'Библиотека' },
  { id: 'communities', label: 'Сообщества' },
  { id: 'customization', label: 'Кастомизация' },
];

const SOURCE_META: Record<string, { title: string; accent: string; subtitle: string }> = {
  all: {
    title: 'Рекомендовано',
    accent: 'Lustre',
    subtitle: 'Подборка по всем вашим интересам: отзывы, избранное, сообщества и покупки.',
  },
  reviews: { title: 'По вашим', accent: 'отзывам', subtitle: 'Основано на играх, которые вы положительно оценили.' },
  favorites: { title: 'На основе', accent: 'избранного', subtitle: 'Основано на играх, добавленных вами в избранное.' },
  library: { title: 'Из вашей', accent: 'библиотеки', subtitle: 'Основано на играх, которые вы добавили в библиотеку.' },
  communities: { title: 'Из ваших', accent: 'сообществ', subtitle: 'Основано на играх сообществ, в которых вы состоите.' },
  customization: {
    title: 'По вашей',
    accent: 'кастомизации',
    subtitle: 'Основано на тегах приобретённых товаров и стиля профиля.',
  },
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

const nf = new Intl.NumberFormat('ru-RU');

export default function RecommendationsScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const [source, setSource] = useState(params.source || 'all');
  const [data, setData] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getRecommendationsFull(source)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(apiError(e, 'Не удалось загрузить рекомендации'));
      })
      .finally(() => setLoading(false));
  }, [source]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const meta = SOURCE_META[source] || SOURCE_META.all;
  const signals = data?.signals;
  const hasSignals =
    !!signals && signals.reviews + signals.favorites + signals.library + signals.communities + signals.purchases > 0;
  const hasTags = !!data && data.tags.length > 0;
  const isEmpty = !data || (data.games.length === 0 && data.items.length === 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Шапка */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Sparkles size={11} color={L.violet} />
            <Text style={styles.heroBadgeText}>Персонально для вас</Text>
          </View>
          <Text style={styles.heroTitle}>
            {meta.title} <Text style={styles.heroAccent}>{meta.accent}</Text>
          </Text>
          <Text style={styles.heroSub}>{meta.subtitle}</Text>

          {hasSignals ? (
            <View style={styles.signals}>
              <Signal icon={<Star size={12} color={L.accent} />} value={signals!.reviews} label="отзывов" />
              <Signal icon={<Heart size={12} color="#fb7185" />} value={signals!.favorites} label="в избранном" />
              <Signal icon={<Gamepad2 size={12} color={L.success} />} value={signals!.library} label="в библиотеке" />
              <Signal icon={<Users size={12} color="#22d3ee" />} value={signals!.communities} label="сообществ" />
              <Signal icon={<ShoppingBag size={12} color={L.violet} />} value={signals!.purchases} label="покупок" />
            </View>
          ) : null}

          {/* Источник рекомендаций */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sourceRow}
            style={styles.sourceScroll}>
            {SOURCES.map((s) => {
              const active = source === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSource(s.id)}
                  style={[styles.source, active && styles.sourceActive, !active && styles.sourceIdle]}>
                  <Text style={[styles.sourceText, active && styles.sourceTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {hasTags ? (
            <View style={styles.liked}>
              <View style={styles.likedLabel}>
                <Tag size={11} color="rgba(244,244,246,0.3)" />
                <Text style={styles.likedLabelText}>Вам нравится</Text>
              </View>
              <View style={styles.tags}>
                {data!.tags.slice(0, 10).map((t) => (
                  <View key={t.id} style={styles.tag}>
                    <Text style={styles.tagText}>{t.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {loading || error ? (
          <DataState loading={loading} error={error} onRetry={load} />
        ) : isEmpty ? (
          <View style={styles.empty}>
            <Sparkles size={26} color="rgba(244,244,246,0.25)" />
            <Text style={styles.emptyTitle}>Пока нечего рекомендовать</Text>
            <Text style={styles.emptyText}>
              Оцените игры, добавьте их в избранное, вступите в сообщества — и подборка появится.
            </Text>
          </View>
        ) : (
          <>
            {data!.games.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionTitleRow}>
                    <Gamepad2 size={16} color={L.accent} />
                    <Text style={styles.sectionTitle}>Игры для вас</Text>
                  </View>
                  <Pressable onPress={() => router.push('/store' as Href)} style={styles.catalogLink} hitSlop={8}>
                    <Text style={styles.catalogText}>В каталог</Text>
                    <ChevronRight size={13} color="rgba(244,244,246,0.35)" />
                  </Pressable>
                </View>
                <View style={styles.grid}>
                  {data!.games.map((g) => (
                    <GameCard key={g.ID} game={g} onPress={() => router.push(`/game/${g.ID}` as Href)} />
                  ))}
                </View>
              </View>
            ) : null}

            {data!.items.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionTitleRow}>
                    <ShoppingBag size={16} color={L.violet} />
                    <Text style={styles.sectionTitle}>Кастомизация для вас</Text>
                  </View>
                </View>
                <View style={styles.grid}>
                  {data!.items.map((it) => (
                    <ItemCard key={it.id} item={it} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Signal({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View style={styles.signal}>
      {icon}
      <Text style={styles.signalValue}>{value}</Text>
      <Text style={styles.signalLabel}>{label}</Text>
    </View>
  );
}

function GameCard({ game, onPress }: { game: RecGame; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardMedia}>
        {game.header_image || game.banner_url ? (
          <Image source={{ uri: game.header_image || game.banner_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardPlaceholder]} />
        )}
        {game.age_rating ? (
          <View style={styles.age}>
            <Text style={styles.ageText}>{game.age_rating}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{game.title}</Text>
        <View style={styles.tags}>
          {(game.tags || []).slice(0, 3).map((t) => (
            <View key={t.id} style={[styles.tag, styles.tagGame]}>
              <Text style={[styles.tagText, styles.tagGameText]}>{t.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function ItemCard({ item }: { item: RecItem }) {
  const isTheme = item.type === 'theme';
  return (
    <View style={[styles.card, styles.cardItem]}>
      <View style={styles.cardMedia}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardPlaceholder, isTheme && styles.themePlaceholder]}>
            <Text style={styles.themeLabel}>{item.scope === 'launcher' ? 'Лаунчер' : 'Профиль'}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, styles.cardTitleSm]} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.rarity}>{RARITY_LABELS[item.rarity] || item.rarity}</Text>
          <Text style={styles.price}>{nf.format(item.price)} ₸</Text>
        </View>
        <View style={styles.tags}>
          {(item.tags || []).slice(0, 2).map((t) => (
            <View key={t.id} style={styles.tag}>
              <Text style={styles.tagText}>{t.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  hero: {
    backgroundColor: '#09070c',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: 'rgba(244,244,246,0.5)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  heroTitle: {
    color: L.text,
    fontSize: 26, fontFamily: 'Tiny5',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: -1,
    marginTop: 14,
  },
  heroAccent: { color: L.violet },
  heroSub: { color: 'rgba(244,244,246,0.4)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18, marginTop: 8 },

  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  signal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  signalValue: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', },
  signalLabel: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  sourceScroll: { flexGrow: 0, marginTop: 16, marginHorizontal: -18 },
  sourceRow: { gap: 8, paddingHorizontal: 18 },
  source: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 14, paddingVertical: 8 },
  sourceIdle: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' },
  sourceActive: { backgroundColor: 'rgba(131,56,236,0.15)', borderColor: 'rgba(131,56,236,0.4)' },
  sourceText: {
    color: 'rgba(244,244,246,0.4)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sourceTextActive: { color: L.violet },

  liked: { marginTop: 16 },
  likedLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  likedLabelText: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { color: 'rgba(244,244,246,0.45)', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  tagGame: { backgroundColor: 'rgba(131,56,236,0.1)', borderColor: 'rgba(131,56,236,0.2)' },
  tagGameText: { color: 'rgba(131,56,236,0.9)' },

  section: { marginBottom: 26 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    color: L.text,
    fontSize: 15, fontFamily: 'Tiny5',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  catalogLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catalogText: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '48%',
    backgroundColor: '#09070c',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85, borderColor: 'rgba(255,0,110,0.3)' },
  cardItem: { borderColor: 'rgba(131,56,236,0.18)' },
  cardMedia: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#121017' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { backgroundColor: 'rgba(131,56,236,0.2)' },
  themePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  themeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  age: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ageText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  cardBody: { padding: 12 },
  cardTitle: { color: L.text, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: -0.2 },
  cardTitleSm: { fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  rarity: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  price: { color: '#fbbf24', fontSize: 11, fontFamily: 'Tiny5', fontStyle: 'italic' },

  empty: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 0,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 13, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 14,
  },
  emptyText: { color: 'rgba(244,244,246,0.55)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 8, lineHeight: 18 },
}));
