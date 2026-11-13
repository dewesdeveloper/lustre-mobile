import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Gem, Lock, X } from 'lucide-react-native';

import {
  buyItem,
  claimDailyBonus,
  equipItem,
  getShop,
  setLauncherBackground,
  unequipSlot,
  type ShopData,
  type ShopItem,
} from '@/api/shop';
import Chip from '@/components/shop/Chip';
import ItemPreview from '@/components/shop/ItemPreview';
import { go } from '@/components/shop/nav';
import { ShopItemCard } from '@/components/shop/ShopItemCard';
import {
  DESCRIPTIONS,
  DESCRIPTIONS_THEME,
  fmtClock,
  isEquipped,
  isImagePayload,
  isOwned,
  nf,
  RARITY_COLOR,
  RARITY_LABEL,
  RARITY_WEIGHT,
  SORTS,
  TYPE_META,
  typeTitle,
  unequipTypeFor,
  withAlpha,
  type ShopProfile,
} from '@/components/shop/shared';
import DataState from '@/components/ui/DataState';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';
import { apiError } from '@/utils/apiError';

interface Promo {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}

const ONLY_FILTERS: { id: string; label: string }[] = [
  { id: 'owned', label: 'Куплено' },
  { id: 'not_owned', label: 'Не куплено' },
  { id: 'equipped', label: 'Надето' },
  { id: 'affordable', label: 'Доступно по балансу' },
  { id: 'launcher', label: 'Темы лаунчера' },
  { id: 'profile_theme', label: 'Темы профиля' },
];

type ShopErrorBody = { code?: string; error?: string; need?: number };

export default function CosmeticsScreen() {
  const { user, refreshUser } = useAuth();

  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [q, setQ] = useState('');
  const [activeType, setActiveType] = useState('');
  const [rarities, setRarities] = useState<string[]>([]);
  const [only, setOnly] = useState<string[]>([]);
  const [sort, setSort] = useState('new');
  const [bannerIdx, setBannerIdx] = useState(0);

  const [preview, setPreview] = useState<ShopItem | null>(null);

  const profile = useMemo(() => (user?.profile ?? {}) as ShopProfile, [user?.profile]);

  const load = useCallback(async () => {
    try {
      setData(await getShop());
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить магазин'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const items = useMemo(() => data?.items || [], [data]);
  const coins = data?.coins ?? 0;

  const allTags = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach((i) => (i.tags || []).forEach((t) => map.set(t.id, t.name)));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [items]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (i.hidden && !data?.is_pro) return false;
      if (activeType && i.type !== activeType) return false;
      if (rarities.length > 0 && !rarities.includes(i.rarity)) return false;
      if (term && !i.name.toLowerCase().includes(term)) return false;
      if (only.includes('owned') && !isOwned(i, data)) return false;
      if (only.includes('not_owned') && isOwned(i, data)) return false;
      if (only.includes('equipped') && !isEquipped(i, profile)) return false;
      if (only.includes('affordable') && coins < i.price) return false;
      if (only.includes('launcher') && !(i.type === 'theme' && i.scope === 'launcher')) return false;
      if (only.includes('profile_theme') && !(i.type === 'theme' && i.scope !== 'launcher')) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'rarity':
          return (RARITY_WEIGHT[b.rarity] || 0) - (RARITY_WEIGHT[a.rarity] || 0);
        case 'name':
          return a.name.localeCompare(b.name, 'ru');
        default:
          return b.id - a.id;
      }
    });
    return list;
  }, [items, activeType, rarities, only, q, sort, data, coins, profile]);

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const resetFilters = () => {
    setQ('');
    setActiveType('');
    setRarities([]);
    setOnly([]);
    setSort('new');
  };

  const filtersActive = rarities.length > 0 || only.length > 0 || !!activeType;

  const bonusReady = !!data?.bonus_ready;
  // Следующий бонус = момент выдачи + 24ч; время фиксировано, таймер не нужен
  const bonusNextAt = data?.next_bonus_at ? new Date(data.next_bonus_at).getTime() + 24 * 3600000 : 0;
  const bonusNextText = bonusNextAt ? fmtClock(bonusNextAt) : '';

  const handleBonus = async () => {
    try {
      await claimDailyBonus();
      await load();
      await refreshUser();
      Alert.alert('Бонус получен', '+250 плодов изгнания зачислено!');
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('Ошибка', msg || 'Бонус уже получен');
      void load();
    }
  };

  const handleBuy = async (item: ShopItem) => {
    if (item.locked) {
      Alert.alert('Только для Pro', 'Этот товар доступен с подпиской Lustre Pro');
      return;
    }
    setBusyId(item.id);
    try {
      // Баланс не проверяем заранее — решение принимает сервер (точный остаток)
      const res = await buyItem(item.id);
      await refreshUser();
      await load();
      setPreview(null);
      Alert.alert(
        'Покупка оформлена',
        res?.equipped
          ? `«${item.name}» надет и уже применён. Остаток: ${nf(res?.coins ?? 0)}.`
          : `«${item.name}» теперь в инвентаре. Остаток: ${nf(res?.coins ?? 0)}.`,
      );
    } catch (e) {
      const resp = (e as { response?: { status?: number; data?: ShopErrorBody } })?.response;
      const body = resp?.data;
      if (body?.code === 'insufficient_funds') {
        const need = body.need || item.price;
        const missing = Math.max(0, need - coins);
        setPreview(null);
        Alert.alert(
          'Не хватает плодов изгнания',
          `Не хватает ещё ${nf(missing)}. Пополнить баланс можно в магазине пакетов или с подпиской Lustre Pro.`,
          Platform.OS === 'ios'
            ? [{ text: 'Понятно' }]
            : [
                { text: 'Позже', style: 'cancel' },
                { text: 'Пополнить', onPress: () => go('/shop/packages') },
              ],
        );
        return;
      }
      if (body?.code === 'pro_required' || body?.code === 'early_access') {
        Alert.alert('Только для Pro', body?.error || 'Нужна подписка Lustre Pro');
        return;
      }
      if (resp?.status === 400) {
        void load();
        Alert.alert('Покупка не выполнена', body?.error || 'Не удалось купить товар');
        return;
      }
      Alert.alert('Ошибка', body?.error || 'Не удалось купить товар');
    } finally {
      setBusyId(null);
    }
  };

  const confirmBuy = (item: ShopItem) => {
    if (item.locked) {
      Alert.alert('Только для Pro', 'Этот товар доступен с подпиской Lustre Pro');
      return;
    }
    Alert.alert('Покупка', `Купить «${item.name}» за ${nf(item.price)} плодов изгнания?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Купить', onPress: () => void handleBuy(item) },
    ]);
  };

  const handleEquip = async (item: ShopItem) => {
    setBusyId(item.id);
    try {
      // Фон лаунчера ставится отдельным эндпоинтом (виден в десктоп-лаунчере)
      if (item.type === 'background') {
        await setLauncherBackground({ item_id: item.id });
      } else {
        await equipItem(item.id);
      }
      await refreshUser();
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('Ошибка', msg || 'Не удалось надеть предмет');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnequip = async (item: ShopItem) => {
    setBusyId(item.id);
    try {
      if (item.type === 'background') await setLauncherBackground({});
      else await unequipSlot(unequipTypeFor(item), item.id);
      await refreshUser();
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('Ошибка', msg || 'Не удалось снять предмет');
    } finally {
      setBusyId(null);
    }
  };

  const promos: Promo[] = [
    {
      key: 'bonus',
      title: 'Ежедневный бонус',
      subtitle: bonusReady
        ? 'Тебе начислено +250 плодов изгнания — забери в один клик'
        : bonusNextText
          ? `Следующий бонус в ${bonusNextText}`
          : 'Бонус можно получить раз в сутки',
      cta: bonusReady ? 'Забрать бонус' : 'Уже получен',
      tint: withAlpha(L.accent, 0.16),
      disabled: !bonusReady,
      onPress: () => {
        if (bonusReady) void handleBonus();
      },
    },
    {
      key: 'launcher',
      title: 'Темы лаунчера',
      subtitle: 'Перекрась весь интерфейс — акценты, свечения, фон',
      cta: 'Смотреть темы',
      tint: withAlpha(L.violet, 0.2),
      onPress: () => {
        setActiveType('theme');
        setOnly(['launcher']);
      },
    },
    {
      key: 'frames',
      title: 'Рамки аватара',
      subtitle: 'Обрами свой аватар — его увидят все в профиле',
      cta: 'Смотреть рамки',
      tint: 'rgba(34,211,238,0.16)',
      onPress: () => {
        setActiveType('frame');
        setOnly([]);
      },
    },
  ];
  const promo = promos[bannerIdx % promos.length];

  const previewOwned = preview ? isOwned(preview, data) : false;
  const previewEquipped = preview ? isEquipped(preview, profile) : false;
  const previewBusy = preview ? busyId === preview.id : false;
  const previewAffordable = preview ? coins >= preview.price : false;

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Поиск по магазину"
          placeholderTextColor={L.muted}
          style={styles.search}
        />
        {filtersActive ? (
          <Pressable onPress={resetFilters} style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}>
            <Text style={styles.resetText}>Сброс</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.filterLabel}>Категории</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Каталог" active={activeType === ''} onPress={() => setActiveType('')} />
        {Object.entries(TYPE_META).map(([id, meta]) => (
          <Chip key={id} label={meta.title} active={activeType === id} onPress={() => setActiveType(id)} />
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Редкость</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {Object.keys(RARITY_LABEL).map((r) => (
          <Chip
            key={r}
            label={RARITY_LABEL[r]}
            active={rarities.includes(r)}
            onPress={() => setRarities((prev) => toggleIn(prev, r))}
          />
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Фильтры</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ONLY_FILTERS.map((o) => (
          <Chip key={o.id} label={o.label} active={only.includes(o.id)} onPress={() => setOnly((prev) => toggleIn(prev, o.id))} />
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Сортировка</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SORTS.map((s) => (
          <Chip key={s.id} label={s.label} active={sort === s.id} onPress={() => setSort(s.id)} />
        ))}
      </ScrollView>

      {allTags.length > 0 ? (
        <>
          <Text style={styles.filterLabel}>Теги</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {allTags.map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                active={false}
                onPress={() => {
                  setQ(t.name);
                  setPreview(null);
                }}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* ПРОМО-БАННЕР */}
      <View style={[styles.banner, { backgroundColor: promo.tint }]}>
        <Text style={styles.bannerKicker}>Событие недели</Text>
        <Text style={styles.bannerTitle}>{promo.title}</Text>
        <Text style={styles.bannerText}>{promo.subtitle}</Text>
        <View style={styles.bannerRow}>
          <Pressable
            onPress={promo.onPress}
            disabled={promo.disabled}
            style={({ pressed }) => [
              styles.bannerCta,
              promo.disabled && styles.bannerCtaOff,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.bannerCtaText}>{promo.cta}</Text>
          </Pressable>
          <Pressable onPress={() => setBannerIdx((i) => (i + 1) % promos.length)} style={styles.bannerNext} hitSlop={6}>
            <ChevronRight size={16} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      </View>

      <Text style={styles.count}>Витрина · {visible.length}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>МАГАЗИН</Text>
        <Text style={styles.sub}>Касса и витрина: темы, рамки, фоны и титулы.</Text>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.coinChip}>
          <Gem size={14} color={L.accent} />
          <Text style={styles.coinText}>{nf(coins)}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow}>
          <Chip label="Инвентарь" onPress={() => go('/inventory')} />
          <Chip label="История" onPress={() => go('/shop/history')} />
          <Chip label="Подписка" onPress={() => go('/shop/subscriptions')} />
          <Chip label="Внешний вид" onPress={() => go('/shop/appearance')} />
        </ScrollView>
      </View>

      {loading || (error && !data) ? (
        <DataState loading={loading} error={loading ? '' : error} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            items.length === 0 ? (
              <DataState empty emptyText="В каталоге пока нет товаров" />
            ) : (
              <View style={styles.emptyBox}>
                <DataState empty emptyText="Ничего не найдено по вашим фильтрам" />
                <Pressable onPress={resetFilters} style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}>
                  <Text style={styles.resetText}>Сбросить фильтры</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ShopItemCard
                item={item}
                owned={isOwned(item, data)}
                equipped={isEquipped(item, profile)}
                canAfford={coins >= item.price}
                busy={busyId === item.id}
                profile={profile}
                onPress={() => setPreview(item)}
              />
            </View>
          )}
        />
      )}

      {/* ===== МОДАЛКА ПРЕДПРОСМОТРА ===== */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPreview(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            {preview ? (
              <>
                <View style={styles.sheetHead}>
                  <View style={styles.flex1}>
                    <Text style={styles.sheetTitle} numberOfLines={2}>
                      {preview.name}
                    </Text>
                    <View style={styles.sheetMetaRow}>
                      <Text style={styles.sheetMeta}>{typeTitle(preview)}</Text>
                      <View style={styles.metaChip}>
                        <Text style={[styles.metaChipText, { color: RARITY_COLOR[preview.rarity] || L.muted }]}>
                          {RARITY_LABEL[preview.rarity] || preview.rarity}
                        </Text>
                      </View>
                    </View>
                    {(preview.tags || []).length > 0 ? (
                      <View style={styles.tagRow}>
                        {(preview.tags || []).map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => {
                              setQ(t.name);
                              setPreview(null);
                            }}
                            style={styles.tagPick}>
                            <Text style={styles.tagPickText}>{t.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => setPreview(null)} style={styles.closeBtn} hitSlop={6}>
                    <X size={16} color={L.text} />
                  </Pressable>
                </View>

                <View style={styles.previewBox}>
                  <ItemPreview item={preview} profile={profile} />
                </View>

                <Text style={styles.desc}>
                  {preview.type === 'theme'
                    ? DESCRIPTIONS_THEME[preview.scope === 'launcher' ? 'launcher' : 'profile']
                    : DESCRIPTIONS[preview.type]}
                </Text>
                <Text style={styles.descMuted}>Средства за этот предмет вернуть нельзя.</Text>

                {preview.type === 'background' || preview.type === 'miniprofile_bg' || (preview.type === 'theme' && preview.scope === 'launcher') ? (
                  <Text style={styles.desktopNote}>Полный превью доступен в десктоп-клиенте</Text>
                ) : null}
                {preview.type === 'frame' && isImagePayload(preview.payload) ? (
                  <Text style={styles.desktopNote}>Масштаб рамки настраивается в десктоп-клиенте</Text>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => setPreview(null)}
                    style={({ pressed }) => [styles.actionGhost, pressed && styles.pressed]}>
                    <Text style={styles.actionGhostText}>{previewOwned ? 'Закрыть' : 'Отмена'}</Text>
                  </Pressable>

                  {previewBusy ? (
                    <View style={styles.actionPrimary}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : previewOwned ? (
                    previewEquipped ? (
                      <>
                        <View style={styles.equippedChip}>
                          <Text style={styles.equippedChipText}>Надето</Text>
                        </View>
                        <Pressable
                          onPress={() => void handleUnequip(preview)}
                          style={({ pressed }) => [styles.actionDanger, pressed && styles.pressed]}>
                          <Text style={styles.actionText}>Снять</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        onPress={() => void handleEquip(preview)}
                        style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}>
                        <Text style={styles.actionText}>Надеть</Text>
                      </Pressable>
                    )
                  ) : (
                    <Pressable
                      onPress={() => confirmBuy(preview)}
                      style={({ pressed }) => [
                        styles.actionPrimary,
                        !previewAffordable && styles.actionGhost,
                        pressed && styles.pressed,
                      ]}>
                      <Gem size={13} color="#fff" />
                      <Text style={styles.actionText}> {nf(preview.price)}</Text>
                    </Pressable>
                  )}
                </View>

                {preview.locked ? (
                  <View style={styles.lockedRow}>
                    <Lock size={13} color="#ffb020" />
                    <Text style={styles.lockedText}>Только для Pro — нужна подписка Lustre Pro</Text>
                  </View>
                ) : null}
                {!preview.locked && !previewOwned && !previewAffordable ? (
                  <Text style={styles.descMuted}>Не хватает плодов изгнания — пополните баланс в десктоп-клиенте.</Text>
                ) : null}
              </>
            ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 1 },
  sub: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', paddingBottom: 4 },

  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: withAlpha(L.accent, 0.08),
    borderRadius: 0,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  coinText: { color: L.accent, fontSize: 13, fontFamily: 'Tiny5', },
  navRow: { gap: 8, paddingRight: 16 },

  pressed: { opacity: 0.75 },
  flex1: { flex: 1, minWidth: 0 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  listHeader: { gap: 4, marginBottom: 8 },
  column: { gap: 12, marginBottom: 12 },
  cell: { flex: 1 },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  search: {
    flex: 1,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    minHeight: 44,
    color: L.text,
    fontSize: 14, fontFamily: 'JetBrainsMono_400Regular',
  },
  resetBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: 'rgba(131,56,236,0.16)',
  },
  resetText: { color: '#fff', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  filterLabel: {
    color: 'rgba(139,139,147,0.85)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 6,
  },
  chipRow: { gap: 8, paddingRight: 8 },
  count: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },

  banner: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 16,
    marginTop: 14,
    gap: 6,
  },
  bannerKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 2.4, textTransform: 'uppercase' },
  bannerTitle: { color: '#fff', fontSize: 16, fontFamily: 'Tiny5', },
  bannerText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  bannerCta: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 0,
    backgroundColor: '#fff',
  },
  bannerCtaOff: { opacity: 0.5 },
  bannerCtaText: { color: '#0b0210', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  bannerNext: {
    width: 44,
    height: 44,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  emptyBox: { alignItems: 'center', gap: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 16 },
  sheet: {
    backgroundColor: L.bg,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    maxHeight: '90%',
  },
  sheetScroll: { padding: 16, gap: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetTitle: { color: '#fff', fontSize: 15, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 0.6 },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  sheetMeta: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  metaChip: { borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: L.card },
  metaChipText: { fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 0.8, textTransform: 'uppercase' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagPick: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingHorizontal: 10,
    backgroundColor: L.card,
  },
  tagPickText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 0, backgroundColor: L.card },
  previewBox: { height: 200, borderRadius: 0, overflow: 'hidden', borderWidth: 1, borderColor: L.border, backgroundColor: '#0f0a17' },
  desc: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20 },
  descMuted: { color: 'rgba(139,139,147,0.8)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17 },
  desktopNote: {
    color: L.muted,
    fontSize: 11, fontFamily: 'JetBrainsMono_400Regular',
    fontStyle: 'italic',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: L.card,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  actionGhost: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: 'transparent',
  },
  actionGhostText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 0,
    backgroundColor: L.accent,
  },
  actionDanger: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: withAlpha(L.danger, 0.6),
    backgroundColor: withAlpha(L.danger, 0.16),
  },
  actionText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  equippedChip: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: withAlpha(L.success, 0.5),
    backgroundColor: withAlpha(L.success, 0.14),
  },
  equippedChipText: { color: L.success, fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedText: { color: '#ffb020', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', flex: 1 },
}));
