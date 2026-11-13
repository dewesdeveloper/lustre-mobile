import { themedStyles } from '@/theme/themedStyles';
import { Image, Pressable, Text, View } from 'react-native';
import { Link2, Lock, Trash, Users } from 'lucide-react-native';

import type { Community } from '@/api/community';
import { L } from '@/constants/lustre';
import { authorName, avatarUri, initials } from './helpers';

interface Props {
  community: Community;
  /** Владелец: бейдж «Владелец» и ссылка-приглашение */
  canManage: boolean;
  /** Владелец или модератор — может удалить сообщество */
  canDelete?: boolean;
  onOpen: () => void;
  onInvite?: () => void;
  onDelete?: () => void;
}

export default function CommunityCard({ community, canManage, canDelete = canManage, onOpen, onInvite, onDelete }: Props) {
  const cover = community.cover_url || community.game?.header_image || community.game?.banner_url || '';
  const name = authorName(community.creator);
  const avatar = avatarUri(community.creator);

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.coverWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]} />
        )}
        <View style={styles.chips}>
          {community.game?.title ? (
            <Text style={[styles.chip, styles.chipViolet]} numberOfLines={1}>
              {community.game.title}
            </Text>
          ) : null}
          {community.theme?.name ? (
            <Text style={[styles.chip, styles.chipAccent]} numberOfLines={1}>
              {community.theme.name}
            </Text>
          ) : null}
          {community.is_private ? (
            <View style={[styles.chip, styles.chipRow]}>
              <Lock size={9} color={L.violet} />
              <Text style={styles.chipPrivateText}>Приватное</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {community.name}
        </Text>
        {community.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {community.description}
          </Text>
        ) : null}

        <View style={styles.footer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials(name)}</Text>
            </View>
          )}
          <Text style={styles.creator} numberOfLines={1}>
            {name}
          </Text>
          {canManage ? (
            <Text style={[styles.badge, styles.badgeOwner]}>Владелец</Text>
          ) : community.is_private ? (
            <Text style={[styles.badge, styles.badgeMember]}>Участник</Text>
          ) : null}
          <View style={styles.members}>
            <Users size={14} color={L.muted} />
            <Text style={styles.membersText}>{community.members_count}</Text>
          </View>
        </View>

        {canManage || canDelete ? (
          <View style={styles.manage}>
            {canManage && community.is_private && onInvite ? (
              <Pressable onPress={onInvite} style={styles.manageBtn} hitSlop={6}>
                <Link2 size={13} color={L.accent} />
                <Text style={styles.manageText}>Ссылка-приглашение</Text>
              </Pressable>
            ) : null}
            {canDelete && onDelete ? (
              <Pressable onPress={onDelete} style={styles.manageBtn} hitSlop={6}>
                <Trash size={13} color={L.danger} />
                <Text style={[styles.manageText, styles.manageDanger]}>Удалить</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  card: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  coverWrap: { height: 140, backgroundColor: '#121017' },
  cover: { width: '100%', height: '100%' },
  coverFallback: { backgroundColor: 'rgba(131,56,236,0.25)' },
  chips: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    maxWidth: 140,
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.65)' },
  chipViolet: { backgroundColor: 'rgba(131,56,236,0.85)' },
  chipAccent: { backgroundColor: 'rgba(255,0,110,0.85)' },
  chipPrivateText: { color: L.violet, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase' },

  body: { padding: 14 },
  name: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 0.5 },
  desc: { color: 'rgba(244,244,246,0.45)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  avatar: { width: 24, height: 24, borderRadius: 0 },
  avatarFallback: { backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: L.text, fontSize: 11, fontFamily: 'Tiny5', },
  creator: { color: 'rgba(244,244,246,0.4)', fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', flex: 1 },
  badge: {
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 0,
    overflow: 'hidden',
  },
  badgeOwner: { color: L.accent, backgroundColor: 'rgba(255,0,110,0.14)' },
  badgeMember: { color: L.success, backgroundColor: 'rgba(52,211,153,0.14)' },
  members: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },

  manage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: L.border,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  manageText: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  manageDanger: { color: L.danger },
}));
