import { themedStyles } from '@/theme/themedStyles';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable } from 'react-native';

import type { UserPresence } from '@/api/presence';
import { L } from '@/constants/lustre';

/**
 * Обложка игры, в которую сейчас играет друг (как в лаунчере). Только для игр из
 * каталога Lustre: по нажатию открывается страница игры.
 */
export default function PlayingCover({ presence }: { presence?: UserPresence }) {
  if (!presence?.playing || !presence.playingCover) return null;
  const open = () => {
    if (presence.playingId) router.push(`/game/${presence.playingId}` as Href);
  };
  return (
    <Pressable
      onPress={open}
      disabled={!presence.playingId}
      hitSlop={6}
      accessibilityLabel={`Открыть игру ${presence.playing}`}
      style={styles.box}>
      <Image source={{ uri: presence.playingCover }} style={styles.img} contentFit="cover" />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  box: { width: 58, height: 27, borderWidth: 1, borderColor: L.accent, backgroundColor: L.cardAlt, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
}));
