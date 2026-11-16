import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  Check,
  ChevronLeft,
  Crown,
  Gem,
  Gift,
  Tag,
} from 'lucide-react-native';

import {
  cancelPro,
  getSubscription,
  grantPro,
  redeemProPromo,
  type ProPlan,
  type ProPlanId,
  type SubscriptionStatus,
} from '@/api/subscriptions';
import { createProPayment, payWithBrowser, type PaymentOrderView } from '@/api/payments';
import Segmented from '@/components/shop/Segmented';
import { fmtDate, nf, withAlpha } from '@/components/shop/shared';
import DataState from '@/components/ui/DataState';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';
import { apiError } from '@/utils/apiError';

// Акцент Pro — золотой (как плашка Pro в десктоп-клиенте)
const GOLD = '#fbbf24';

export default function SubscriptionsScreen() {
  const { user, refreshUser } = useAuth();

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<ProPlanId | null>(null);

  const [promo, setPromo] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState('');

  const giftShown = useRef(0);

  const load = useCallback(async (): Promise<SubscriptionStatus | null> => {
    try {
      const next = await getSubscription();
      setStatus(next);
      setError('');
      return next;
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить подписку'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Ежемесячная выплата: показываем один раз сразу после начисления
  useEffect(() => {
    if (!status?.gift_granted || !status.gift_amount || giftShown.current === status.gift_amount) return;
    giftShown.current = status.gift_amount;
    Alert.alert('Ежемесячная выплата', `Начислено +${nf(status.gift_amount)} плодов изгнания`);
    void load();
  }, [status, load]);

  const isPro = !!status?.is_pro;
  const isAdmin = user?.role === 'admin';

  const finishPayment = async (final: PaymentOrderView | null) => {
    if (final?.status === 'succeeded') {
      await refreshUser();
      const fresh = await load();
      Alert.alert(
        'Подписка оформлена',
        `Lustre Pro активен до ${fmtDate(fresh?.pro_until)}. Ежемесячная выплата начисляется по тарифу.`,
      );
      return;
    }
    if (final && final.status !== 'pending') {
      Alert.alert(
        'Оплата не завершена',
        final.status === 'canceled'
          ? 'Платёж отменён — можно попробовать снова.'
          : 'Платёж не прошёл — можно попробовать снова.',
      );
      return;
    }
    Alert.alert(
      'Статус не подтверждён',
      'Подтверждение оплаты ещё идёт — обновите страницу через минуту.',
    );
  };

  const handleBuy = async (plan: ProPlan) => {
    if (busy) return;
    setBusy(plan.id);
    try {
      const order = await createProPayment(plan.id);
      const final = await payWithBrowser(order);
      await finishPayment(final);
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось создать платёж'));
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Отключить подписку',
      'Все преимущества Lustre Pro перестанут действовать сразу. Продолжить?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отключить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await cancelPro();
                await refreshUser();
                await load();
              } catch {
                Alert.alert('Ошибка', 'Не удалось отключить подписку');
              }
            })();
          },
        },
      ],
    );
  };

  const handlePromo = async () => {
    const code = promo.trim();
    if (!code || promoBusy) return;
    setPromoBusy(true);
    setPromoError('');
    try {
      const res = await redeemProPromo(code);
      await refreshUser();
      setPromo('');
      await load();
      Alert.alert('Промокод активирован', `Подписка продлена на ${res.days} дней`);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPromoError(msg || 'Проверьте код');
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={18} color={L.accent} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle}>ПОДПИСКА</Text>
          <Text style={styles.headerSub}>Lustre Pro: статус, косметика, лимиты и выплаты.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading || !status ? (
          <DataState loading={loading} error={loading ? '' : error} onRetry={() => void load()} />
        ) : (
          <>
            {/* ===== ШАПКА ===== */}
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Crown size={12} color={GOLD} />
                <Text style={styles.heroBadgeText}>{isPro ? 'Продление Premium' : 'Lustre Pro'}</Text>
              </View>
              <Text style={styles.h1}>
                {isPro ? 'ПРОДЛИ СВОЙ ' : 'ПРОКАЧАЙ СВОЙ '}
                <Text style={styles.h1Accent}>{isPro ? 'PREMIUM' : 'LUSTRE'}</Text>
              </Text>
              <Text style={styles.heroText}>
                {isPro
                  ? 'Время продления добавится к текущей подписке. Premium продолжает работать без перерыва.'
                  : 'Все игры бесплатны. Подписка продаёт не доступ, а статус, комфорт и косметику.'}
              </Text>
              {isPro && status.pro_until ? (
                <View style={styles.untilBox}>
                  <View style={styles.untilDot} />
                  <Text style={styles.untilText}>
                    Текущая подписка активна до <Text style={styles.untilDate}>{fmtDate(status.pro_until)}</Text>
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ===== ТАРИФЫ ===== */}
            <View style={styles.plans}>
              {(status.plans || []).map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  active={status.pro_plan === plan.id}
                  busy={busy === plan.id}
                  onBuy={() => void handleBuy(plan)}
                />
              ))}
            </View>

            {/* ===== ПРЕИМУЩЕСТВА ===== */}
            <View style={[styles.panel, styles.benefitsPanel]}>
              <Text style={styles.panelKicker}>Акцент подписки</Text>
              <Text style={styles.h2}>ЧТО ВХОДИТ В LUSTRE PRO</Text>
              <View style={styles.benefits}>
                {(status.benefits || []).map((b) => (
                  <View key={b.key} style={styles.benefitRow}>
                    <Check size={15} color={GOLD} style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>{b.title}</Text>
                      {b.hint ? <Text style={styles.benefitHint}> {b.hint}</Text> : null}
                      {b.pro_only ? <Text style={styles.benefitOnly}> только подписка</Text> : null}
                    </Text>
                  </View>
                ))}
              </View>

              {status.limits ? (
                <View style={styles.limits}>
                  <LimitChip label="Групп" value={`${status.limits.groups}`} />
                  <LimitChip label="Участников" value={`${status.limits.group_members}`} />
                  <LimitChip label="Витрин" value={`${status.limits.showcases}`} />
                  <LimitChip label="Избранного" value={`${status.limits.favorites}`} />
                </View>
              ) : null}
            </View>

            {/* ===== ПОДАРОК ДРУГУ ===== */}
            <View style={styles.panel}>
              <View style={styles.rowStart}>
                <View style={styles.iconBox}>
                  <Gift size={22} color={L.accent} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.panelTitle}>
                    Подарить <Text style={styles.accentText}>Premium</Text> другу
                  </Text>
                  <Text style={styles.panelText}>
                    От {nf(249)} ₽. Мгновенная активация. Получи прогресс в бейдже «Меценат».
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Подарочные коды',
                    'Промокоды выдаются в поддержке. Пока можно активировать промокод ниже.',
                  )
                }
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}>
                <Text style={styles.ghostBtnText}>Подарить</Text>
              </Pressable>
            </View>

            {/* ===== ПРОМОКОД ===== */}
            <View style={styles.panel}>
              <View style={styles.rowStart}>
                <View style={styles.iconBox}>
                  <Tag size={22} color={L.accent} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.panelTitle}>Есть промокод?</Text>
                  <Text style={styles.panelText}>Введи код и получи скидку прямо сейчас</Text>
                  <Text style={styles.panelHint}>Подсказка: ищи промокоды в нашем Telegram-канале</Text>
                </View>
              </View>
              <Label>Промокод</Label>
              <Input
                value={promo}
                onChangeText={setPromo}
                placeholder="ВВЕДИТЕ ПРОМОКОД"
                autoCapitalize="characters"
                style={styles.promoInput}
              />
              <ErrorText>{promoError}</ErrorText>
              <Button title="Применить" onPress={() => void handlePromo()} loading={promoBusy} disabled={!promo.trim()} />
            </View>

            <Text style={styles.disclaimer}>
              Подписка не продлевается автоматически. Вы можете отменить её в любой момент.
            </Text>

            {/* ===== СТАТУС ===== */}
            {isPro ? (
              <View style={styles.statusCard}>
                <View style={styles.statusAvatar}>
                  {user?.profile?.avatar_url ? (
                    <Image source={{ uri: user.profile.avatar_url }} style={styles.statusAvatarImg} />
                  ) : (
                    <Text style={styles.statusAvatarLetter}>
                      {(user?.username || '?')[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.statusKicker}>Подписка активна</Text>
                  <View style={styles.rowStart}>
                    <Text style={styles.statusValue}>{status.days_left} дн. осталось</Text>
                    <View style={styles.proChip}>
                      <Crown size={10} color={GOLD} />
                      <Text style={styles.proChipText}>PRO</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={handleCancel} style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}>
                  <Text style={styles.ghostBtnText}>Отключить Pro</Text>
                </Pressable>
              </View>
            ) : null}

            {isAdmin ? <AdminGrant onGranted={() => void load()} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- карточка тарифа ---
function PlanCard({ plan, active, busy, onBuy }: { plan: ProPlan; active: boolean; busy: boolean; onBuy: () => void }) {
  const hot = plan.highlight;
  return (
    <View style={[styles.plan, hot && styles.planHot]}>
      {plan.badge ? (
        <View style={[styles.planBadge, hot ? styles.planBadgeHot : styles.planBadgeSoft]}>
          <Text style={[styles.planBadgeText, hot && styles.planBadgeTextHot]}>{plan.badge}</Text>
        </View>
      ) : null}

      <Text style={styles.planTitle}>{plan.title}</Text>

      <View style={styles.planPriceRow}>
        <Text style={styles.planPrice}>{nf(plan.price)}₽</Text>
        {plan.old_price > plan.price ? <Text style={styles.planOld}>{nf(plan.old_price)}₽</Text> : null}
      </View>

      {plan.save_pct > 0 ? (
        <Text style={styles.planSave}>
          Выгода {plan.save_pct}%
          <Text style={styles.planSaveMuted}> {nf(plan.per_month)}₽/мес</Text>
        </Text>
      ) : null}

      <View style={[styles.planGift, hot && styles.planGiftHot]}>
        <View style={styles.rowStart}>
          <Gem size={15} color={L.accent} />
          <Text style={styles.planGiftValue}> +{nf(plan.gift_per_month)}</Text>
          <Text style={styles.planGiftLabel}> плодов изгнания каждый месяц</Text>
        </View>
        {plan.months > 1 ? (
          <Text style={styles.planGiftNote}>
            до {nf(plan.gift_total)} плодов изгнания за {plan.months} мес — если забирать каждый месяц
          </Text>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <Text style={styles.planIosNote}>
          Оплата на iOS недоступна — оформите подписку на сайте или в десктоп-лаунчере
        </Text>
      ) : (
        <Pressable
          onPress={onBuy}
          disabled={busy}
          style={({ pressed }) => [styles.planBtn, hot && styles.planBtnHot, (busy || pressed) && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.planBtnText}>{active ? 'Продлить' : 'Продлить подписку'}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function LimitChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.limitChip}>
      <Text style={styles.limitValue}>{value}</Text>
      <Text style={styles.limitLabel}>{label}</Text>
    </View>
  );
}

// --- админ: выдача подписки ---
function AdminGrant({ onGranted }: { onGranted: () => void }) {
  const [username, setUsername] = useState('');
  const [plan, setPlan] = useState<ProPlanId>('month');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!username.trim() || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = (await grantPro({ username: username.trim(), plan })) as {
        username?: string;
        plan?: { title?: string };
      };
      setResult(`Выдано: ${res?.username || username.trim()} (тариф ${res?.plan?.title || plan})`);
      setUsername('');
      onGranted();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setResult('');
      setErr(msg || apiError(e, 'Ошибка'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.rowStart}>
        <Crown size={15} color={GOLD} />
        <Text style={[styles.panelTitle, styles.flex1]}>Админ: выдать подписку</Text>
      </View>
      <Text style={styles.panelText}>Выдача работает только для администраторов</Text>
      <Label>Логин пользователя</Label>
      <Input value={username} onChangeText={setUsername} placeholder="Логин пользователя" autoCapitalize="none" />
      <Label>Тариф</Label>
      <Segmented
        options={[
          { id: 'month', label: 'Месяц' },
          { id: 'quarter', label: '3 месяца' },
          { id: 'year', label: 'Год' },
        ]}
        value={plan}
        onChange={(id) => setPlan(id as ProPlanId)}
      />
      <ErrorText>{err}</ErrorText>
      {result ? <Text style={styles.adminResult}>{result}</Text> : null}
      <Button title="Выдать" onPress={() => void submit()} loading={busy} disabled={!username.trim()} />
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  headerTexts: { gap: 4, paddingBottom: 4 },
  headerTitle: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', letterSpacing: 1 },
  headerSub: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  content: { padding: 16, paddingTop: 12, paddingBottom: 48, gap: 12 },

  pressed: { opacity: 0.75 },
  flex1: { flex: 1, minWidth: 0 },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },

  // HERO
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(GOLD, 0.4),
    backgroundColor: withAlpha(GOLD, 0.1),
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: { color: GOLD, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 2, textTransform: 'uppercase' },
  h1: { color: '#fff', fontSize: 22, fontFamily: 'Tiny5', textAlign: 'center', letterSpacing: 0.5 },
  h1Accent: { color: L.accent },
  heroText: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20, textAlign: 'center' },
  untilBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: withAlpha(L.accent, 0.06),
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  untilDot: { width: 6, height: 6, borderRadius: 0, backgroundColor: L.accent },
  untilText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  untilDate: { color: '#fff', fontWeight: '800' },

  // PLANS
  plans: { gap: 12, marginTop: 4 },
  plan: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    gap: 8,
  },
  planHot: { borderColor: L.accent },
  planBadge: {
    alignSelf: 'flex-start',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planBadgeHot: { backgroundColor: L.accent },
  planBadgeSoft: { backgroundColor: withAlpha(L.accent, 0.16), borderWidth: 1, borderColor: L.border },
  planBadgeText: { color: L.accent, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase' },
  planBadgeTextHot: { color: '#0b0210' },
  planTitle: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase' },
  planPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  planPrice: { color: '#fff', fontSize: 30, fontFamily: 'Tiny5', },
  planOld: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', textDecorationLine: 'line-through', paddingBottom: 5 },
  planSave: { color: '#34d399', fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.2, textTransform: 'uppercase' },
  planSaveMuted: { color: L.muted, fontWeight: '600', textTransform: 'none', letterSpacing: 0 },
  planGift: {
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: withAlpha(L.accent, 0.05),
    borderRadius: 0,
    padding: 12,
    gap: 6,
    marginTop: 4,
  },
  planGiftHot: { backgroundColor: withAlpha(L.accent, 0.09) },
  planGiftValue: { color: '#fff', fontSize: 15, fontFamily: 'Tiny5', },
  planGiftLabel: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', flexShrink: 1 },
  planGiftNote: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17 },
  planIosNote: {
    color: L.muted,
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    lineHeight: 17,
    marginTop: 14,
  },
  planBtn: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: 'rgba(131,56,236,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  planBtnHot: { backgroundColor: L.accent, borderColor: L.accent },
  planBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.4 },

  // PANELS
  panel: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    gap: 10,
  },
  benefitsPanel: { borderColor: withAlpha(GOLD, 0.45) },
  panelKicker: { color: GOLD, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 2.4, textTransform: 'uppercase' },
  h2: { color: '#fff', fontSize: 15, fontFamily: 'Tiny5', letterSpacing: 0.5 },
  panelTitle: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1.2, textTransform: 'uppercase' },
  panelText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 4 },
  panelHint: { color: 'rgba(139,139,147,0.75)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
  accentText: { color: L.accent },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: withAlpha(L.accent, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefits: { gap: 12, marginTop: 6 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  benefitIcon: { marginTop: 2 },
  benefitText: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20, flex: 1 },
  benefitTitle: { color: '#fff' },
  benefitHint: { color: L.muted },
  benefitOnly: {
    color: GOLD,
    fontSize: 10, fontFamily: 'Tiny5',
    letterSpacing: 1,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: withAlpha(GOLD, 0.4),
    backgroundColor: withAlpha(GOLD, 0.1),
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  limits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  limitChip: {
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  limitValue: { color: '#fff', fontSize: 20, fontFamily: 'Tiny5', },
  limitLabel: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase' },

  ghostBtn: {
    minHeight: 44,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  ghostBtnText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  promoInput: { textTransform: 'uppercase' },
  disclaimer: { color: 'rgba(139,139,147,0.8)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 17, marginTop: 4 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
    marginTop: 4,
  },
  statusAvatar: {
    width: 52,
    height: 52,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: GOLD,
    backgroundColor: L.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statusAvatarImg: { width: '100%', height: '100%' },
  statusAvatarLetter: { color: '#fff', fontSize: 20, fontFamily: 'Tiny5', },
  statusKicker: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.6, textTransform: 'uppercase' },
  statusValue: { color: '#fff', fontSize: 13, fontFamily: 'Tiny5', letterSpacing: 0.6, textTransform: 'uppercase' },
  proChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: withAlpha(GOLD, 0.5),
    backgroundColor: withAlpha(GOLD, 0.12),
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proChipText: { color: GOLD, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1 },
  adminResult: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },

}));
