import { themedStyles } from '@/theme/themedStyles';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';

import type { ShopItem } from '@/api/shop';
import { L } from '@/constants/lustre';
import ItemPreview from './ItemPreview';
import { RARITY_COLOR, RARITY_LABEL, typeLabel, withAlpha, type ShopProfile } from './shared';

interface Props {
  item: ShopItem;
  equipped: boolean;
  busy?: boolean;
  profile?: ShopProfile | null;
  onToggle: () => void;
}

/** Карточка приобретённого предмета: превью + «Надеть»/«Снять». */
export default function OwnedItemCard({ item, equipped, busy, profile, onToggle }: Props) {
  const rarity = RARITY_COLOR[item.rarity] || L.muted;

  return (
    <View style={[styles.card, equipped && styles.cardEquipped]}>
      <View style={styles.preview}>
        <ItemPreview item={item} profile={profile} />
        <View style={[styles.rarity, { borderColor: withAlpha(rarity, 0.55), backgroundColor: withAlpha(rarity, 0.14) }]}>
          <Text style={[styles.rarityText, { color: rarity }]}>{RARITY_LABEL[item.rarity] || item.rarity}</Text>
        </View>
        {equipped ? (
          <View style={styles.equippedBadge}>
            <Check size={9} color={L.success} />
            <Text style={styles.equippedBadgeText}>Надето</Text>
          </View>
        ) : null}
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
        <Text style={styles.type}>{typeLabel(item)}</Text>

        <View style={styles.row}>
          <Text style={[styles.status, equipped && styles.statusOn]} numberOfLines={1}>
            {equipped ? 'используется' : 'не используется'}
          </Text>
          <Pressable
            onPress={onToggle}
            disabled={busy}
            style={({ pressed }) => [
              styles.btn,
              equipped ? styles.btnGhost : styles.btnPrimary,
              busy && styles.btnBusy,
              pressed && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                {!equipped ? <Plus size={12} color="#fff" /> : null}
                <Text style={styles.btnText}>{equipped ? 'Снять' : 'Надеть'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
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
  cardEquipped: { borderColor: L.borderStrong },
  pressed: { opacity: 0.75 },
  preview: { height: 104, backgroundColor: '#0f0a17' },
  rarity: { position: 'absolute', top: 8, left: 8, borderWidth: 1, borderRadius: 0, paddingHorizontal: 7, paddingVertical: 3 },
  rarityText: { fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1, textTransform: 'uppercase' },
  equippedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: withAlpha(L.success, 0.4),
    backgroundColor: 'rgba(15,10,23,0.85)',
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  equippedBadgeText: { color: L.success, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 0.8, textTransform: 'uppercase' },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 12, gap: 3 },
  name: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  type: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  status: { color: 'rgba(139,139,147,0.85)', fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 0.8, textTransform: 'uppercase', flex: 1 },
  statusOn: { color: L.success },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    minWidth: 92,
    borderRadius: 0,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  btnPrimary: { backgroundColor: L.accent, borderColor: L.accent },
  btnGhost: { backgroundColor: 'transparent', borderColor: L.border },
  btnBusy: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 0.8 },
}));
