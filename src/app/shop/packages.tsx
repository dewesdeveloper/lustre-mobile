import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Crown, Gem } from 'lucide-react-native';

import { getCoinPackages, type CoinPackage, type CoinPackagesData } from '@/api/coinHistory';
import { createCoinPayment, payWithBrowser } from '@/api/payments';
import { go } from '@/components/shop/nav';
import { nf } from '@/components/shop/shared';
import DataState from '@/components/ui/DataState';
import { L } from '@/constants/lustre';
import { themedStyles } from '@/theme/themedStyles';
import { apiError } from '@/utils/apiError';

export default function CoinPackagesScreen() {
  const [pkgs, setPkgs] = useState<CoinPackagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setPkgs(await getCoinPackages());
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить пакеты валюты'));
      setPkgs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const buy = async (p: CoinPackage) => {
    if (busy || Platform.OS === 'ios') return;
    setBusy(p.id);
    try {
      const order = await createCoinPayment(p.id);
      const final = await payWithBrowser(order);
      if (final?.status === 'succeeded') {
        Alert.alert('Пакет оплачен', `Начислено ${nf(final.coins)} плодов изгнания`);
        void load();
      } else if (final && final.status !== 'pending') {
        Alert.alert(
          'Оплата не завершена',
          final.status === 'canceled'
            ? 'Платёж отменён — можно попробовать снова.'
            : 'Платёж не прошёл — можно попробовать снова.',
        );
      } else {
        Alert.alert('Статус не подтверждён', 'Подтверждение оплаты ещё идёт — обновите страницу через минуту.');
      }
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось создать платёж'));
    } finally {
      setBusy('');
    }
  };

  const listHeader = (
    <View style={styles.head}>
      <Text style={styles.title}>ПАКЕТЫ ВАЛЮТЫ</Text>
      <Text style={styles.sub}>
        Пополните баланс плодов изгнания — они тратятся на косметику, темы и титулы.
      </Text>

      {pkgs?.premium && !pkgs.is_pro ? (
        <Pressable onPress={() => go('/shop/subscriptions')} style={({ pressed }) => [styles.premium, pressed && styles.pressed]}>
          <View style={styles.premiumRow}>
            <Crown size={15} color={GOLD} />
            <Text style={styles.premiumTitle}>Premium платит плодами</Text>
          </View>
          <Text style={styles.premiumText}>
            +{nf(pkgs.premium.gift_now)} при активации и до {nf(pkgs.premium.gift_total)} в год. Тариф от {nf(pkgs.premium.price_rub)} ₽
          </Text>
          <Text style={styles.premiumLink}>Оформить подписку →</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (loading || (error && !pkgs)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
        </View>
        <DataState
          loading={loading}
          error={loading ? '' : error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!pkgs || pkgs.packages.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
        </View>
        <DataState empty emptyText="Пакеты временно недоступны" />
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
        data={pkgs.packages}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <PackageCard
            pkg={item}
            busy={busy === item.id}
            canBuy={Platform.OS !== 'ios'}
            onBuy={() => void buy(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const GOLD = '#fbbf24';

function PackageCard({ pkg, busy, canBuy, onBuy }: {
  pkg: CoinPackage;
  busy: boolean;
  canBuy: boolean;
  onBuy: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{pkg.title}</Text>
        {pkg.badge ? <Text style={styles.cardBadge}>{pkg.badge}</Text> : null}
      </View>

      <View style={styles.cardCoins}>
        <Gem size={17} color={L.accent} />
        <Text style={styles.cardCoinsValue}>{nf(pkg.coins)}</Text>
        {pkg.bonus_pct > 0 ? <Text style={styles.cardBonus}>+{pkg.bonus_pct}%</Text> : null}
      </View>
      <Text style={styles.cardCoinsNote}>плодов изгнания</Text>

      <View style={styles.cardFoot}>
        <Text style={styles.cardPrice}>{nf(pkg.price_rub)} ₽</Text>
        {canBuy ? (
          <Pressable
            onPress={onBuy}
            disabled={busy}
            style={({ pressed }) => [styles.buyBtn, (busy || pressed) && styles.pressed]}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buyText}>Купить</Text>}
          </Pressable>
        ) : (
          <Text style={styles.iosNote}>Оплата на iOS недоступна — покупайте на сайте или в десктоп-лаунчере</Text>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold' },
  pressed: { opacity: 0.75 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40, gap: 10 },
  head: { gap: 12, marginBottom: 8 },
  title: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', letterSpacing: 1 },
  sub: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20 },

  premium: {
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    borderRadius: 0,
    padding: 14,
    gap: 8,
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  premiumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumTitle: { color: GOLD, fontSize: 11, fontFamily: 'Tiny5', letterSpacing: 1, flexShrink: 1 },
  premiumText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  premiumLink: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  card: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 1 },
  cardBadge: {
    color: L.accent,
    fontSize: 10,
    fontFamily: 'JetBrainsMono_700Bold',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: L.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  cardCoins: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardCoinsValue: { color: '#fff', fontSize: 24, fontFamily: 'Tiny5' },
  cardBonus: { color: '#c084fc', fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  cardCoinsNote: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: L.border,
    flexWrap: 'wrap',
  },
  cardPrice: { color: '#fff', fontSize: 16, fontFamily: 'JetBrainsMono_700Bold' },
  buyBtn: {
    minHeight: 40,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.accent,
    backgroundColor: L.accent,
  },
  buyText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1, textTransform: 'uppercase' },
  iosNote: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17, flex: 1, minWidth: 180, textAlign: 'right' },
}));
