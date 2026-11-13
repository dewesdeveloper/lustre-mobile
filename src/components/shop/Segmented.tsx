import { themedStyles } from '@/theme/themedStyles';
import { Pressable, Text, View } from 'react-native';

import { L } from '@/constants/lustre';

interface Props {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}

/** Горизонтальный сегментированный переключатель (замена десктопным табам). */
export default function Segmented({ options, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            hitSlop={4}
            style={({ pressed }) => [styles.btn, active && styles.btnActive, pressed && styles.pressed]}>
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    backgroundColor: L.card,
    overflow: 'hidden',
  },
  btn: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  btnActive: { backgroundColor: 'rgba(255,0,110,0.16)' },
  pressed: { opacity: 0.75 },
  text: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  textActive: { color: '#fff' },
}));
