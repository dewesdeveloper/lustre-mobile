import { themedStyles } from '@/theme/themedStyles';
import { Pressable, Text } from 'react-native';

import { L } from '@/constants/lustre';

interface Props {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Фильтровый чип (горизонтальная лента), высота ≥44px под палец. */
export default function Chip({ label, active, disabled, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, (disabled || pressed) && styles.pressed]}>
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    backgroundColor: L.card,
  },
  chipActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.16)' },
  pressed: { opacity: 0.75 },
  text: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  textActive: { color: '#fff' },
}));
