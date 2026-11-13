import { themedStyles } from '@/theme/themedStyles';
import {
  ActivityIndicator,
  Pressable,

  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { L } from '@/constants/lustre';

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input({ style, multiline, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={L.muted}
      multiline={multiline}
      {...props}
      style={[styles.input, multiline && styles.inputMultiline, style]}
    />
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ title, onPress, loading, disabled, variant = 'primary' }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        (isDisabled || pressed) && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: L.bg,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  label: {
    color: L.muted,
    fontSize: 11, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#08050f',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: L.text,
    fontSize: 15, fontFamily: 'JetBrainsMono_400Regular',
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: L.accent,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 48,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: L.border,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 10,
    // запас по высоте строки — без него многострочные
    // подписи кнопок налезают друг на друга
    lineHeight: 18,
    fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  error: {
    color: L.danger,
    fontSize: 12, fontFamily: 'JetBrainsMono_400Regular',
    marginTop: 12,
  },
}));
