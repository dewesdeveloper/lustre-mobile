import { themedStyles } from '@/theme/themedStyles';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { VoiceUser } from '@/api/voiceChannel';
import { L } from '@/constants/lustre';

/** Аватар участника голосового канала; зелёная рамка — говорит прямо сейчас. */
export default function VoiceAvatar({ user, size, speaking }: { user: VoiceUser; size: number; speaking?: boolean }) {
  const ring = speaking ? styles.speaking : styles.idle;
  return (
    <View style={[styles.box, ring, { width: size, height: size }]}>
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.img} contentFit="cover" />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.45) }]}>
          {(user.display_name || user.username || '?')[0]?.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  box: { alignItems: 'center', justifyContent: 'center', backgroundColor: L.cardAlt, overflow: 'hidden', borderWidth: 2 },
  idle: { borderColor: 'transparent' },
  speaking: { borderColor: L.success },
  img: { width: '100%', height: '100%' },
  initial: { color: L.text, fontFamily: 'Tiny5' },
}));
