import { themedStyles } from '@/theme/themedStyles';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Film, LayoutTemplate } from 'lucide-react-native';

import type { ShopItem } from '@/api/shop';
import { L } from '@/constants/lustre';
import { isImagePayload, RARITY_COLOR, withAlpha, type ShopProfile } from './shared';

const DESKTOP_NOTE = 'Полный превью доступен в десктоп-клиенте';

interface Props {
  item: ShopItem;
  profile?: ShopProfile | null;
}

/** Превью товара, заполняющее родительский контейнер. */
export default function ItemPreview({ item, profile }: Props) {
  const avatarUrl = typeof profile?.avatar_url === 'string' ? profile.avatar_url : '';
  const rarity = RARITY_COLOR[item.rarity] || L.accent;
  const accent = item.scope === 'launcher' ? L.violet : L.accent;

  switch (item.type) {
    case 'avatar': {
      const uri = item.image_url || item.payload;
      return (
        <View style={styles.fill}>
          {isImagePayload(uri) ? <Image source={{ uri }} style={styles.circle} resizeMode="cover" /> : <View style={[styles.circle, styles.placeholder]} />}
        </View>
      );
    }

    case 'banner': {
      const uri = item.image_url || item.payload;
      return (
        <View style={styles.fill}>
          {isImagePayload(uri) ? <Image source={{ uri }} style={styles.fill} resizeMode="cover" /> : <View style={[styles.fill, styles.placeholder]} />}
          <View style={styles.fade} />
          <Text style={styles.corner}>Фон профиля</Text>
        </View>
      );
    }

    case 'frame': {
      return (
        <View style={styles.fill}>
          <View style={[styles.frameRing, { borderColor: rarity }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.frameAvatar} resizeMode="cover" />
            ) : (
              <View style={[styles.frameAvatar, styles.placeholder]} />
            )}
          </View>
        </View>
      );
    }

    case 'theme':
      return (
        <View style={[styles.fill, styles.themeBase]}>
          <View style={[styles.themeBlob, { backgroundColor: withAlpha(accent, 0.45) }]} />
          <View style={[styles.fill, { backgroundColor: withAlpha(L.violet, 0.12) }]} />
          <View style={styles.themeFooter}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <View style={[styles.dot, { backgroundColor: L.violet }]} />
            <Text style={styles.themeLabel}>{item.scope === 'launcher' ? 'Лаунчер' : 'Профиль'}</Text>
          </View>
        </View>
      );

    case 'background': {
      const uri = item.image_url || item.payload;
      if (item.is_video) {
        return (
          <View style={styles.fill}>
            <View style={[styles.fill, styles.placeholder, styles.centerCol]}>
              <Film size={22} color={L.muted} />
              <Text style={styles.note}>Видео-фон</Text>
              <Text style={styles.noteSmall}>{DESKTOP_NOTE}</Text>
            </View>
            <Text style={styles.corner}>Фон лаунчера</Text>
          </View>
        );
      }
      return (
        <View style={styles.fill}>
          {isImagePayload(uri) ? <Image source={{ uri }} style={styles.fill} resizeMode="cover" /> : <View style={[styles.fill, styles.placeholder]} />}
          <View style={styles.grid} />
          <Text style={styles.corner}>Фон лаунчера</Text>
        </View>
      );
    }

    case 'tag': {
      const color = RARITY_COLOR[item.rarity] || L.muted;
      return (
        <View style={styles.fill}>
          <View style={[styles.tagChip, { borderColor: withAlpha(color, 0.5), backgroundColor: withAlpha(color, 0.12) }]}>
            <Text style={[styles.tagText, { color }]} numberOfLines={2}>
              {item.payload}
            </Text>
          </View>
        </View>
      );
    }

    case 'miniprofile_bg': {
      const uri = item.image_url || item.payload;
      return (
        <View style={styles.fill}>
          {isImagePayload(uri) ? <Image source={{ uri }} style={styles.fill} resizeMode="cover" /> : <View style={[styles.fill, styles.placeholder]} />}
          <View style={[styles.miniCard, { backgroundColor: withAlpha(L.violet, 0.35) }]}>
            <LayoutTemplate size={16} color="#fff" />
            <Text style={styles.miniText}>Минипрофиль</Text>
          </View>
        </View>
      );
    }

    default:
      return <View style={[styles.fill, styles.placeholder]} />;
  }
}

const styles = themedStyles(() => ({
  fill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  centerCol: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  placeholder: { backgroundColor: '#0f0a17' },
  circle: { width: 76, height: 76, borderRadius: 0, backgroundColor: '#000' },
  fade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,7,12,0.35)' },
  corner: {
    position: 'absolute',
    left: 8,
    bottom: 6,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10, fontFamily: 'Tiny5',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  frameRing: {
    width: 74,
    height: 74,
    borderRadius: 0,
    borderWidth: 3,
    padding: 3,
    backgroundColor: '#000',
  },
  frameAvatar: { width: '100%', height: '100%', borderRadius: 0 },
  themeBase: { backgroundColor: '#0d0b13', alignItems: 'flex-start', justifyContent: 'flex-end' },
  themeBlob: { position: 'absolute', top: -28, right: -24, width: 110, height: 110, borderRadius: 0 },
  themeFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10 },
  dot: { width: 10, height: 10, borderRadius: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  themeLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10, fontFamily: 'Tiny5',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  grid: {
    ...StyleSheet.absoluteFill,
    borderColor: withAlpha(L.violet, 0.2),
    borderWidth: 1,
    margin: 14,
    borderRadius: 0,
    opacity: 0.7,
  },
  tagChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 0, borderWidth: 1, maxWidth: '85%' },
  tagText: { fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center' },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  miniText: { color: '#fff', fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase' },
  note: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  noteSmall: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 14 },
}));
