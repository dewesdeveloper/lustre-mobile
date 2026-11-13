import { themedStyles } from '@/theme/themedStyles';
import { Text, View } from 'react-native';

import { useConnectivity } from '@/context/ConnectivityContext';
import { L } from '@/constants/lustre';

/** Тонкая полоса о недоступности сервера (аналог оффлайн-режима в десктопе). */
export default function OfflineBanner() {
  const { online, checking } = useConnectivity();
  if (online) return null;

  return (
    <View style={styles.bar}>
      <Text style={styles.text}>{checking ? 'Проверка соединения…' : 'Нет соединения с сервером'}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  bar: { backgroundColor: L.danger, paddingVertical: 4, alignItems: 'center' },
  text: { color: '#fff', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
}));
