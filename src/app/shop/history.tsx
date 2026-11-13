import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Gem } from 'lucide-react-native';

import { getCoinHistory, type CoinTx } from '@/api/coinHistory';
import Segmented from '@/components/shop/Segmented';
import { fmtWhen, nf, withAlpha } from '@/components/shop/shared';
import DataState from '@/components/ui/DataState';
import { L } from '@/constants/lustre';
import { apiError } from '@/utils/apiError';

type Filter = 'all' | 'earn' | 'spend';

const PAGE = 25;

export default function CoinHistoryScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<CoinTx[]>([]);
  const [totals, setTotals] = useState({ earned: 0, spent: 0, bought: 0 });
  const [balance, setBalance] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (kind: Filter, off = 0, append = false) => {
    try {
      const data = await getCoinHistory({ limit: PAGE, offset: off, kind });
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotals(data.totals);
      setBalance(data.balance);
      setHasMore(data.has_more);
      setOffset(off);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить историю операций'));
      if (!append) setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // загрузка асинхронна — setState выполняется только после await
      void load(filter).then(() => setLoading(false));
    }, [load, filter]),
  );

  const changeFilter = (id: string) => {
    setFilter(id as Filter);
    setLoading(true);
  };

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await load(filter, offset + PAGE, true);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, hasMore, load, loading, loadingMore, offset]);

  const listHeader = (
    <View style={styles.head}>
      <Text style={styles.title}>ИСТОРИЯ ОПЕРАЦИЙ</Text>
      <Text style={styles.sub}>
        Каждое начисление и каждая трата плодов изгнания — с суммой, причиной и балансом после операции.
      </Text>

      <View style={styles.totals}>
        <TotalCard label="Заработано" value={totals.earned} tint={L.success} icon={<ArrowDownLeft size={13} color={L.success} />} />
        <TotalCard label="Потрачено" value={totals.spent} tint={L.text} icon={<ArrowUpRight size={13} color={L.text} />} />
        <TotalCard label="Куплено в магазине" value={totals.bought} tint={L.accent} icon={<Gem size={13} color={L.accent} />} />
      </View>

      <Segmented
        options={[
          { id: 'all', label: 'Все' },
          { id: 'earn', label: 'Приход' },
          { id: 'spend', label: 'Расход' },
        ]}
        value={filter}
        onChange={changeFilter}
      />

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Источник: все источники</Text>
        <View style={styles.balanceRight}>
          <Text style={styles.balanceLabel}>Баланс:</Text>
          <Text style={styles.balanceValue}>{nf(balance)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>

      {loading || (error && items.length === 0) ? (
        <DataState
          loading={loading}
          error={loading ? '' : error}
          onRetry={() => {
            setLoading(true);
            void load(filter).then(() => setLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(tx) => String(tx.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<DataState empty emptyText="Операций пока нет" />}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={L.accent} style={styles.moreLoader} />
            ) : hasMore ? (
              <Pressable onPress={() => void loadMore()} style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}>
                <Text style={styles.moreText}>Показать ещё</Text>
              </Pressable>
            ) : items.length > 0 ? (
              <Text style={styles.endNote}>Это все операции</Text>
            ) : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => <TxRow tx={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function TotalCard({ label, value, tint, icon }: { label: string; value: number; tint: string; icon: React.ReactNode }) {
  return (
    <View style={styles.totalCard}>
      <View style={styles.totalHead}>
        {icon}
        <Text style={[styles.totalLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.totalValue}>{nf(value)}</Text>
    </View>
  );
}

function TxRow({ tx }: { tx: CoinTx }) {
  const isEarn = tx.kind === 'earn';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, isEarn ? styles.txIconEarn : styles.txIconSpend]}>
        {isEarn ? <ArrowDownLeft size={17} color={L.success} /> : <ArrowUpRight size={17} color={L.muted} />}
      </View>

      <View style={styles.flex1}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.title || 'Операция'}
        </Text>
        <Text style={styles.txSource} numberOfLines={1}>
          {tx.source}
        </Text>
        <Text style={styles.txDate}>{fmtWhen(tx.created_at)}</Text>
      </View>

      <View style={styles.txRight}>
        <Text style={[styles.txAmount, isEarn && styles.txAmountEarn]}>
          {isEarn ? '+' : '−'}
          {nf(Math.abs(tx.amount))}
        </Text>
        <Text style={styles.txBalance}>
          <Text style={styles.txBalanceLabel}>остаток </Text>
          {nf(tx.balance_after)}
        </Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  pressed: { opacity: 0.75 },
  flex1: { flex: 1, minWidth: 0 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40, gap: 8 },
  head: { gap: 12, marginBottom: 8 },
  title: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', letterSpacing: 1 },
  sub: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20 },

  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  totalCard: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
    gap: 8,
  },
  totalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalLabel: { fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase', flexShrink: 1 },
  totalValue: { color: '#fff', fontSize: 22, fontFamily: 'Tiny5', },

  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  balanceRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceLabel: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.6, textTransform: 'uppercase' },
  balanceValue: { color: '#fff', fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
  },
  txIcon: { width: 44, height: 44, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  txIconEarn: { borderColor: withAlpha(L.success, 0.4), backgroundColor: withAlpha(L.success, 0.1) },
  txIconSpend: { borderColor: L.border, backgroundColor: 'rgba(255,255,255,0.05)' },
  txTitle: { color: '#fff', fontSize: 11, fontFamily: 'Tiny5', letterSpacing: 0.8, textTransform: 'uppercase' },
  txSource: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  txDate: { color: 'rgba(139,139,147,0.75)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { color: '#fff', fontSize: 15, fontFamily: 'Tiny5', },
  txAmountEarn: { color: L.success },
  txBalance: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  txBalanceLabel: { opacity: 0.7 },

  moreLoader: { marginTop: 18 },
  moreBtn: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    marginTop: 14,
  },
  moreText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  endNote: { color: 'rgba(139,139,147,0.7)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 16 },
}));
