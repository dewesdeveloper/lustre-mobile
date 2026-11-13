import { themedStyles } from '@/theme/themedStyles';
import { Image, Pressable, Text, View } from 'react-native';
import { ChevronRight, MessageSquare, Trash } from 'lucide-react-native';

import type { CommunityImage, CommunityPost } from '@/api/community';
import { L } from '@/constants/lustre';
import { authorName, avatarUri, formatDate, initials, isPro } from './helpers';

interface PostCardProps {
  post: CommunityPost;
  canDelete?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
  commentsCount?: number;
  full?: boolean;
}

export function PostCard({ post, canDelete, onPress, onDelete, commentsCount, full }: PostCardProps) {
  const name = authorName(post.author);
  const avatar = avatarUri(post.author);
  const showFooter = !full;

  const body = (
    <View style={styles.row}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.nameRow}>
            {isPro(post.author) ? <Text style={styles.proChip}>PRO</Text> : null}
            <Text style={styles.author} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Text style={styles.date}>{formatDate(post.CreatedAt)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={full ? undefined : 2}>
          {post.title}
        </Text>
        {post.content ? (
          <Text style={styles.content} numberOfLines={full ? undefined : 4}>
            {post.content}
          </Text>
        ) : null}

        {showFooter ? (
          <View style={styles.footer}>
            <MessageSquare size={13} color={L.muted} />
            <Text style={styles.footerText}>
              Обсудить{typeof commentsCount === 'number' ? ` · ${commentsCount}` : ''}
            </Text>
            <ChevronRight size={13} color={L.muted} />
          </View>
        ) : null}
      </View>

      {canDelete && onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.trash}>
          <Trash size={15} color={L.muted} />
        </Pressable>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        {body}
      </Pressable>
    );
  }

  return <View style={styles.card}>{body}</View>;
}

interface ImageCardProps {
  image: CommunityImage;
  canDelete?: boolean;
  onDelete?: () => void;
  full?: boolean;
}

export function ImageCard({ image, canDelete, onDelete, full }: ImageCardProps) {
  const name = authorName(image.author);
  const avatar = avatarUri(image.author);

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: image.url }}
        style={[styles.photo, full ? styles.photoFull : null]}
        resizeMode="cover"
      />
      <View style={styles.photoFooter}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarSmall} />
        ) : (
          <View style={[styles.avatarSmall, styles.avatarFallback]}>
            <Text style={styles.avatarTextSmall}>{initials(name)}</Text>
          </View>
        )}
        <Text style={styles.photoAuthor} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.date}>{formatDate(image.CreatedAt)}</Text>
        {canDelete && onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.trash}>
            <Trash size={15} color={L.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 14,
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 40, height: 40, borderRadius: 0 },
  avatarFallback: { backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', },
  avatarSmall: { width: 24, height: 24, borderRadius: 0 },
  avatarTextSmall: { color: L.text, fontSize: 11, fontFamily: 'Tiny5', },
  body: { flex: 1, minWidth: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  proChip: {
    color: '#0b0210',
    backgroundColor: L.accent,
    fontSize: 10, fontFamily: 'Tiny5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  author: { color: 'rgba(244,244,246,0.6)', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase' },
  date: { color: 'rgba(244,244,246,0.6)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  title: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', marginTop: 8 },
  content: { color: 'rgba(244,244,246,0.55)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  footerText: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trash: { padding: 2 },
  photo: { width: '100%', height: 180, borderRadius: 0, backgroundColor: '#000', marginTop: 2 },
  photoFull: { height: 240 },
  photoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: L.border,
  },
  photoAuthor: { color: 'rgba(244,244,246,0.5)', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', flex: 1 },
}));
