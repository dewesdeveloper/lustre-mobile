import { themedStyles } from '@/theme/themedStyles';
import { Image, Pressable, Text, View } from 'react-native';
import { Sparkles, Tag } from 'lucide-react-native';

import type { NewsItem } from '@/api/news';
import { fmtNewsDate, newsCatMeta, newsExcerpt } from '@/components/news/newsMeta';
import { L } from '@/constants/lustre';

interface Props {
  item: NewsItem;
  onPress?: () => void;
}

/** Карточка новости в ленте: обложка, категория, дата, теги. */
export default function NewsCard({ item, onPress }: Props) {
  const meta = newsCatMeta(item.category);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={[styles.chipText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
        {item.for_you ? (
          <View style={[styles.chip, styles.chipForYou]}>
            <Sparkles size={9} color={L.accent} />
            <Text style={[styles.chipText, { color: L.accent, marginLeft: 4 }]}>Для вас</Text>
          </View>
        ) : null}
        {item.created_at ? <Text style={styles.date}>{fmtNewsDate(item.created_at)}</Text> : null}
      </View>

      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}

      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      {item.content ? <Text style={styles.excerpt} numberOfLines={3}>{newsExcerpt(item.content)}</Text> : null}

      {item.tags && item.tags.length > 0 ? (
        <View style={styles.tags}>
          <Tag size={11} color="rgba(244,244,246,0.25)" />
          {item.tags.slice(0, 4).map((t) => (
            <View key={t.id} style={styles.tag}>
              <Text style={styles.tagText}>{t.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.more}>Подробнее →</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  card: {
    backgroundColor: '#09070c',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
  },
  pressed: { opacity: 0.85, borderColor: 'rgba(255,0,110,0.25)' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipForYou: { backgroundColor: 'rgba(255,0,110,0.1)', borderColor: 'rgba(255,0,110,0.3)' },
  chipText: { fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  date: {
    marginLeft: 'auto',
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  image: {
    width: '100%',
    height: 170,
    borderRadius: 0,
    marginBottom: 12,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  title: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: -0.3 },
  excerpt: { color: 'rgba(244,244,246,0.45)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 8 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  tag: {
    backgroundColor: 'rgba(131,56,236,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(131,56,236,0.2)',
    borderRadius: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { color: 'rgba(131,56,236,0.9)', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  more: {
    color: 'rgba(244,244,246,0.4)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 14,
  },
}));
