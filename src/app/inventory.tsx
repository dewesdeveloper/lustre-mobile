import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Gem, ShoppingBag } from 'lucide-react-native';

import { equipItem, getShop, unequipSlot, type ShopData, type ShopItem } from '@/api/shop';
import Chip from '@/components/shop/Chip';
import { go } from '@/components/shop/nav';
import OwnedItemCard from '@/components/shop/OwnedItemCard';
import { isEquipped, isOwned, nf, unequipTypeFor, withAlpha, type ShopProfile } from '@/components/shop/shared';
import DataState from '@/components/ui/DataState';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';
import { apiError } from '@/utils/apiError';

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'avatar', label: 'Аватары' },
  { id: 'frame', label: 'Рамки аватара' },
  { id: 'banner', label: 'Фоны профиля' },
  { id: 'theme', label: 'Темы' },
  { id: 'tag', label: 'Титулы' },
  { id: 'background', label: 'Фоны лаунчера' },
];

export default function InventoryScreen() {
  const { user, refreshUser } = useAuth();

  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tab, setTab] = useState('all');

  const profile = (user?.profile ?? {}) as ShopProfile;

  const load = useCallback(async () => {
    try {
      setData(await getShop());
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить инвентарь'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ownedItems = useMemo(() => (data?.items || []).filter((i) => isOwned(i, data)), [data]);
  const visible = useMemo(
    () => (tab === 'all' ? ownedItems : ownedItems.filter((i) => i.type === tab)),
    [ownedItems, tab],
  );
  const coins = data?.coins ?? 0;

  const handleEquip = async (item: ShopItem) => {
    setBusyId(item.id);
    try {
      await equipItem(item.id);
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
      await unequipSlot(unequipTypeFor(item), item.id);
      await refreshUser();
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('Ошибка', msg || 'Не удалось снять предмет');
    } finally {
      setBusyId(null);
    }
  };

  const listHeader = (
    <View style={styles.head}>
      <Text style={styles.title}>ИНВЕНТАРЬ</Text>
      <View style={styles.headRow}>
        <Text style={styles.count}>
          Всего предметов: <Text style={styles.countValue}>{ownedItems.length}</Text>
        </Text>
        <View style={styles.coinChip}>
          <Gem size={14} color={L.accent} />
          <Text style={styles.coinText}>{nf(coins)}</Text>
        </View>
        <Pressable onPress={() => go('/shop/cosmetics')} style={({ pressed }) => [styles.shopBtn, pressed && styles.pressed]}>
          <ShoppingBag size={14} color="#fff" />
          <Text style={styles.shopBtnText}>В магазин</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map((t) => (
          <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
        ))}
      </ScrollView>

      <Pressable onPress={() => go('/shop/appearance')} style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}>
        <Text style={styles.ghostBtnText}>Внешний вид</Text>
      </Pressable>
    </View>
  );

  if (loading || (error && !data)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
        </View>
        <DataState loading={loading} error={loading ? '' : error} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  if (ownedItems.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
        </View>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Инвентарь пуст</Text>
          <Text style={styles.emptyText}>Купи что-нибудь в магазине кастомизаций</Text>
          <Pressable onPress={() => go('/shop/cosmetics')} style={({ pressed }) => [styles.shopBtn, pressed && styles.pressed]}>
            <ShoppingBag size={14} color="#fff" />
            <Text style={styles.shopBtnText}>Открыть магазин</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<DataState empty emptyText="В этом разделе пока нет предметов" />}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <OwnedItemCard
              item={item}
              equipped={isEquipped(item, profile)}
              busy={busyId === item.id}
              profile={profile}
              onToggle={() => {
                if (isEquipped(item, profile)) void handleUnequip(item);
                else void handleEquip(item);
              }}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  pressed: { opacity: 0.75 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  column: { gap: 12, marginBottom: 12 },
  cell: { flex: 1 },

  head: { gap: 12, marginBottom: 12 },
  title: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  count: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', flexShrink: 1 },
  countValue: { color: '#fff', fontWeight: '900' },
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
  coinText: { color: '#fff', fontSize: 13, fontFamily: 'Tiny5', },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 0,
    backgroundColor: L.accent,
  },
  shopBtnText: { color: '#fff', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  ghostBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
  },
  ghostBtnText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  tabRow: { gap: 8, paddingRight: 8 },

  emptyBox: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 56 },
  emptyTitle: { color: L.muted, fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 2, textTransform: 'uppercase' },
  emptyText: { color: 'rgba(139,139,147,0.8)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 19 },
}));
