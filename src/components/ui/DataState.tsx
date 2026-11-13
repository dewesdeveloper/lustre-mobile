import { themedStyles } from '@/theme/themedStyles';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { L } from '@/constants/lustre';

interface Props {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
}

/** Единый вывод состояния списка: загрузка / ошибка / пусто. */
export default function DataState({ loading, error, empty, emptyText, onRetry }: Props) {
  if (loading) {
    return <ActivityIndicator color={L.accent} style={styles.loader} />;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        {onRetry && (
          <Pressable onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        )}
      </View>
    );
  }
  if (empty) {
    return <Text style={styles.empty}>{emptyText || 'Пусто'}</Text>;
  }
  return null;
}

const styles = themedStyles(() => ({
  loader: { marginTop: 40 },
  center: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24, gap: 14 },
  error: { color: L.danger, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 19 },
  retry: { borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  empty: { color: L.muted, textAlign: 'center', marginTop: 40, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
}));
