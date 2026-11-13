import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Lock, Plus, X } from 'lucide-react-native';

import { Input } from '@/components/ui/form';
import { L } from '@/constants/lustre';
import {
  MAX_CUSTOM_TAGS,
  MAX_SHOP_TAGS,
  MAX_TAGS,
  SHOP_RARITY_COLOR,
  type ProfileTag,
  type ShopItem,
} from '@/api/profile';

const PRESET_COLORS = ['#A78BFA', '#22D3EE', '#F472B6', '#FBBF24', '#34D399', '#F87171'];

type Props = {
  tags: ProfileTag[];
  onChange: (tags: ProfileTag[]) => void;
  /** Только купленные титулы (type === 'tag'). */
  shopTagItems: ShopItem[];
};

export default function TagsEditor({ tags, onChange, shopTagItems }: Props) {
  const [text, setText] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const customCount = tags.filter((t) => t.custom).length;
  const shopCount = tags.filter((t) => !t.custom).length;
  const full = tags.length >= MAX_TAGS;
  const canAddCustom = customCount < MAX_CUSTOM_TAGS && !full && text.trim().length > 0;

  const removeTag = (i: number) => onChange(tags.filter((_, idx) => idx !== i));

  const addCustom = () => {
    if (!canAddCustom) return;
    onChange([...tags, { text: text.trim().slice(0, 16), color, custom: true, item_id: 0 }]);
    setText('');
  };

  const addShopTag = (item: ShopItem) => {
    if (full || shopCount >= MAX_SHOP_TAGS) return;
    if (tags.some((t) => t.item_id === item.id)) return;
    onChange([
      ...tags,
      { text: item.payload, color: SHOP_RARITY_COLOR[item.rarity] || '#9CA3AF', custom: false, item_id: item.id },
    ]);
  };

  const addedItemIds = new Set(tags.filter((t) => !t.custom).map((t) => t.item_id));

  return (
    <View>
      <View style={styles.headRow}>
        <Text style={styles.label}>Титулы · {tags.length}/{MAX_TAGS}</Text>
        <Text style={styles.hint}>1 свой + до {MAX_SHOP_TAGS} из магазина</Text>
      </View>

      {tags.length > 0 && (
        <View style={styles.chips}>
          {tags.map((t, i) => {
            const c = t.color || L.violet;
            return (
              <View
                key={`${t.text}-${i}`}
                style={[styles.chip, { borderColor: `${c}99`, backgroundColor: `${c}22` }]}>
                <Text style={[styles.chipText, { color: c }]}>{t.text}</Text>
                <Pressable onPress={() => removeTag(i)} hitSlop={8} accessibilityLabel="Убрать">
                  <X size={12} color={c} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.label}>Свой титул</Text>
      {customCount >= MAX_CUSTOM_TAGS ? (
        <Text style={styles.hint}>Свой титул уже добавлен.</Text>
      ) : (
        <View>
          <Input
            value={text}
            onChangeText={(v) => setText(v.slice(0, 16))}
            placeholder="Например: GOLD"
            maxLength={16}
            autoCapitalize="characters"
          />
          <View style={styles.customRow}>
            <View style={styles.swatches}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
            <Pressable
              onPress={addCustom}
              disabled={!canAddCustom}
              style={[styles.addBtn, !canAddCustom && styles.addBtnDisabled]}>
              <Plus size={14} color={canAddCustom ? '#0b0210' : L.muted} />
              <Text style={[styles.addBtnText, !canAddCustom && styles.addBtnTextDisabled]}>Добавить</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={[styles.label, styles.shopLabel]}>Титулы из магазина</Text>
      {shopTagItems.length === 0 ? (
        <View style={styles.noShop}>
          <Lock size={13} color={L.muted} />
          <Text style={styles.hint}>Нет купленных титулов — их можно приобрести в магазине.</Text>
        </View>
      ) : (
        <View style={styles.shopGrid}>
          {shopTagItems.map((item) => {
            const added = addedItemIds.has(item.id);
            const disabled = added || full || shopCount >= MAX_SHOP_TAGS;
            const c = SHOP_RARITY_COLOR[item.rarity] || '#9CA3AF';
            return (
              <Pressable
                key={item.id}
                onPress={() => addShopTag(item)}
                disabled={disabled}
                style={[
                  styles.shopItem,
                  added && styles.shopItemAdded,
                  disabled && !added && styles.shopItemDisabled,
                ]}>
                <Text style={[styles.shopPayload, { color: c }]} numberOfLines={1}>
                  {item.payload}
                </Text>
                <Text style={styles.shopName} numberOfLines={1}>
                  {added ? 'Добавлен' : item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 },
  label: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  shopLabel: { marginTop: 20 },
  hint: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { width: 22, height: 22, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong },
  swatchActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: L.accent,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnDisabled: { backgroundColor: L.cardAlt },
  addBtnText: { color: '#0b0210', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  addBtnTextDisabled: { color: L.muted },
  noShop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shopItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: L.card,
  },
  shopItemAdded: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.08)' },
  shopItemDisabled: { opacity: 0.4 },
  shopPayload: { fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  shopName: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
}));
