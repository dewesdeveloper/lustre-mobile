import { themedStyles } from '@/theme/themedStyles';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ChevronRight, Lock } from 'lucide-react-native';

import { L } from '@/constants/lustre';

/** Панель-секция с заголовком и необязательным описанием. */
export function Section({
  title,
  subtitle,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

/** Строка-переход. disabled — недоступная на мобильном настройка с подсказкой. */
export function Row({
  label,
  hint,
  value,
  onPress,
  disabled,
  icon,
  danger,
  last,
}: {
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
}) {
  const rowStyle = last ? [styles.row, styles.rowLast] : styles.row;
  const content = (
    <>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && styles.dangerText]} numberOfLines={1}>
          {label}
        </Text>
        {disabled || hint ? (
          <Text style={styles.rowHint} numberOfLines={2}>
            {disabled ? 'Настройка доступна в десктоп-клиенте' : hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {disabled ? (
        <Lock size={16} color={L.muted} style={styles.rowChevron} />
      ) : (
        <ChevronRight size={16} color={L.muted} style={styles.rowChevron} />
      )}
    </>
  );

  if (disabled || !onPress) {
    return (
      <View style={[rowStyle, styles.rowDisabled]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [rowStyle, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

/** Строка с переключателем. */
export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
  last,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={last ? [styles.row, styles.rowLast] : styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: 'rgba(255,255,255,0.12)', true: L.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

/** Сегментированный выбор (как tl-tabs на десктопе). */
export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.segItem, active && styles.segItemActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Аватар: удалённое изображение или буква (SVG на React Native не рендерится). */
export function Avatar({ url, name, size = 48 }: { url?: string; name?: string; size?: number }) {
  const isSvg = /\.svg(\?|$)/i.test(url || '');
  const radius = Math.round(size / 4);
  if (url && !isSvg) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: L.cardAlt }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: radius },
      ]}>
      <Text style={[styles.avatarLetter, { fontSize: Math.round(size * 0.4) }]}>
        {(name || '?')[0]?.toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 18,
  },
  sectionTitle: {
    color: L.text,
    fontSize: 12, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sectionSub: {
    color: L.muted,
    fontSize: 12, fontFamily: 'JetBrainsMono_400Regular',
    lineHeight: 18,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.border,
  },
  rowDisabled: { opacity: 0.55 },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.6 },
  rowIcon: { width: 24, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  rowHint: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 15, marginTop: 2 },
  rowValue: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', maxWidth: '40%' },
  rowChevron: { flexShrink: 0 },
  dangerText: { color: L.danger },
  seg: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segItem: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: L.cardAlt,
  },
  segItemActive: {
    borderColor: L.accent,
    backgroundColor: 'rgba(255,0,110,0.12)',
  },
  segText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  segTextActive: { color: L.text },
  avatarFallback: {
    backgroundColor: L.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: L.text, fontWeight: '900' },
}));
