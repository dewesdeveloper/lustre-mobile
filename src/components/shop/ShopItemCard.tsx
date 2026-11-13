import { themedStyles } from '@/theme/themedStyles';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Clock, Crown, Gem, Lock, ShoppingCart } from 'lucide-react-native';

import type { ShopItem } from '@/api/shop';
import { L } from '@/constants/lustre';
import ItemPreview from './ItemPreview';
import { nf, RARITY_COLOR, RARITY_LABEL, typeTitle, withAlpha, type ShopProfile } from './shared';

interface ShopItemCardProps {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  busy?: boolean;
  profile?: ShopProfile | null;
  onPress: () => void;
}

/** Карточка товара витрины: тап открывает предпросмотр с покупкой/надением. */
export function ShopItemCard({ item, owned, equipped, canAfford, busy, profile, onPress }: ShopItemCardProps) {
  const rarity = RARITY_COLOR[item.rarity] || L.muted;
  const actionLabel = item.locked
    ? 'Pro'
    : owned
      ? equipped
        ? 'Снять'
        : 'Надеть'
      : 'Купить';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, item.hidden && styles.dim, pressed && styles.pressed]}>
      <View style={styles.preview}>
        <ItemPreview item={item} profile={profile} />

        <View style={[styles.rarity, { borderColor: withAlpha(rarity, 0.55), backgroundColor: withAlpha(rarity, 0.14) }]}>
          <Text style={[styles.rarityText, { color: rarity }]}>{RARITY_LABEL[item.rarity] || item.rarity}</Text>
        </View>

        <View style={styles.badges}>
          {item.locked ? <Badge tone="warn" icon={<Crown size={9} color={L.text} />} text="Только Pro" /> : null}
          {!item.locked && item.early_days ? <Badge tone="warn" icon={<Clock size={9} color={L.text} />} text="Ранний доступ" /> : null}
          {equipped ? <Badge tone="ok" icon={<Check size={9} color={L.success} />} text="Надето" /> : null}
          {!equipped && owned ? <Badge tone="muted" text="Куплено" /> : null}
        </View>

        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.type}>{typeTitle(item)}</Text>

        {(item.tags || []).length > 0 ? (
          <View style={styles.tags}>
            {(item.tags || []).slice(0, 3).map((t) => (
              <View key={t.id} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {t.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.row}>
          <View style={styles.priceBox}>
            {item.locked ? (
              <View style={styles.statusRow}>
                <Lock size={11} color="#ffb020" />
                <Text style={styles.lockedText}>Нужна подписка</Text>
              </View>
            ) : equipped ? (
              <Text style={styles.equippedText}>◆ НАДЕТО</Text>
            ) : owned ? (
              <Text style={styles.ownedText}>◆ В ИНВЕНТАРЕ</Text>
            ) : (
              <View style={styles.statusRow}>
                <Gem size={13} color={L.accent} />
                <Text style={[styles.price, !canAfford && styles.pricePoor]}>{nf(item.price)}</Text>
              </View>
            )}
          </View>

          <View style={styles.action}>
            {!item.locked && !owned ? <ShoppingCart size={11} color="#fff" /> : null}
            <Text style={styles.actionText}>{actionLabel}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Badge({ tone, icon, text }: { tone: 'warn' | 'ok' | 'muted'; icon?: React.ReactNode; text: string }) {
  const color = tone === 'warn' ? '#ffb020' : tone === 'ok' ? L.success : L.muted;
  return (
    <View style={[styles.badge, { borderColor: withAlpha(color, 0.5), backgroundColor: withAlpha(color, 0.14) }]}>
      {icon}
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    overflow: 'hidden',
    width: '100%',
  },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  preview: { height: 118, backgroundColor: '#0f0a17' },
  rarity: { position: 'absolute', top: 8, left: 8, borderWidth: 1, borderRadius: 0, paddingHorizontal: 7, paddingVertical: 3 },
  rarityText: { fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1, textTransform: 'uppercase' },
  badges: { position: 'absolute', top: 8, right: 8, alignItems: 'flex-end', gap: 5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badgeText: { fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 0.8, textTransform: 'uppercase' },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 12, gap: 3 },
  name: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  type: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: { borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: L.cardAlt },
  tagText: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, minHeight: 30 },
  priceBox: { flex: 1, minWidth: 0 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  price: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', },
  pricePoor: { color: 'rgba(248,113,113,0.9)' },
  lockedText: { color: '#ffb020', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  equippedText: { color: L.success, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 0.6 },
  ownedText: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 0.6 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: 'rgba(131,56,236,0.16)',
  },
  actionText: { color: '#fff', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 0.8 },
}));
