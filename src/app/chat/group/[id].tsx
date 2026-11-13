import { themedStyles } from '@/theme/themedStyles';
import { openExternalUrl } from '@/utils/openUrl';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Download,
  FileText,
  ImagePlus,
  Paperclip,
  Pencil,
  Phone,
  Pin,
  Play,
  Reply,
  Send,
  Users,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';

import {
  getGroup,
  getGroupMessages,
  type GroupMember,
  type GroupMessage,
} from '@/api/groups';
import {
  sendWS,
  uploadChatAttachment,
  wsDeleteGroupMessages,
  wsEditGroupMessage,
  wsForwardGroup,
  wsPinGroupMessage,
  type PickedFile,
} from '@/api/chat';
import { joinGroupCall, startGroupCall } from '@/api/groupCall';
import { useGroupActiveCalls } from '@/api/groupCallPresence';
import { useChatEvents } from '@/hooks/use-chat';
import { useAuth } from '@/context/AuthContext';
import { chatMessageLimit } from '@/api/subscriptions';
import { apiError } from '@/utils/apiError';
import { formatDay, formatTime } from '@/utils/chatFormat';
import { L } from '@/constants/lustre';
import { MessageActionsSheet } from '@/components/chat/MessageActionsSheet';
import { DeleteConfirmDialog } from '@/components/chat/DeleteConfirmDialog';
import { ForwardPickerDialog } from '@/components/chat/ForwardPickerDialog';

function formatBytes(n?: number): string {
  if (!n || n <= 0) return '';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default function GroupConversationScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const groupId = Number(params.id);
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const activeCalls = useGroupActiveCalls();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState(params.name || 'Группа');
  const activeCall = activeCalls.get(groupId) ?? null;
  const inCall = !!activeCall?.participants.some((p) => p.id === myId);
  // Звонок уже идёт — подключаемся к нему, а не начинаем новый
  const callGroup = () => {
    const me = { id: myId, username: user?.username || 'Вы' };
    if (activeCall) joinGroupCall(activeCall.call_id, groupId, groupName, me);
    else startGroupCall(groupId, groupName, me);
  };
  const [avatarUrl, setAvatarUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const listRef = useRef<FlatList<GroupMessage>>(null);

  // Действия над сообщениями
  const [ownerId, setOwnerId] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sheetFor, setSheetFor] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [forwarding, setForwarding] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState<number[] | null>(null);

  useChatEvents((data) => {
    switch (data.type) {
      case 'group.message': {
        const msg = data.message as GroupMessage | undefined;
        if (msg && msg.group_id === groupId) {
          // Сообщение пришло в открытый чат — оно прочитано
          if (msg.sender_id !== myId) sendWS({ type: 'group.read', group_id: groupId });
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
        break;
      }
      case 'group.message.updated': {
        const upd = data.message as { id: number; content: string; edited_at?: string } | undefined;
        if (upd && data.group_id === groupId) {
          setMessages((prev) => prev.map((m) => (m.id === upd.id ? { ...m, content: upd.content, edited_at: upd.edited_at } : m)));
        }
        break;
      }
      case 'group.message.deleted': {
        const ids = (data.message_ids as number[]) || [];
        if (data.group_id === groupId && ids.length) {
          const nowIso = new Date().toISOString();
          setMessages((prev) => prev.map((m) => (ids.includes(m.id)
            ? { ...m, content: '', deleted_at: nowIso, attachment_url: undefined, attachment_name: undefined }
            : m)));
        }
        break;
      }
      case 'group.message.hidden': {
        const ids = (data.message_ids as number[]) || [];
        if (data.group_id === groupId && ids.length) {
          setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
        }
        break;
      }
      case 'group.message.pinned': {
        if (data.group_id === groupId) {
          const pinnedNow = !!data.pinned;
          setMessages((prev) => prev.map((m) => (m.id === data.message_id
            ? { ...m, pinned_at: pinnedNow ? new Date().toISOString() : null }
            : m)));
        }
        break;
      }
      case 'group.deleted': {
        if (data.group_id === groupId) router.back();
        break;
      }
    }
  });

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    Promise.all([getGroup(groupId), getGroupMessages(groupId)])
      .then(([details, list]) => {
        if (cancelled) return;
        setGroupName(details.name || groupName);
        setAvatarUrl(details.avatar_url || '');
        setMembers(details.members || []);
        setOwnerId(details.owner_id || 0);
        setMessages(list);
      })
      .catch((e) => {
        if (!cancelled) setError(apiError(e, 'Не удалось загрузить группу'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const send = () => {
    const content = text.trim();
    if (!content) return;
    // Режим редактирования
    if (editing) {
      const id = editing.id;
      const original = editing.content;
      setEditing(null);
      setText('');
      if (content !== original) {
        wsEditGroupMessage(groupId, id, content);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, edited_at: new Date().toISOString() } : m)));
      }
      return;
    }
    const replyId = replyTo && replyTo.id > 0 ? replyTo.id : undefined;
    sendWS({ type: 'group.message', group_id: groupId, content, ...(replyId ? { reply_to_id: replyId } : {}) });
    setText('');
    setReplyTo(null);
  };

  // --- выделение и меню ---
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectMode = selected.size > 0;
  const pinnedMsg = [...messages].reverse().find((m) => m.pinned_at) || null;
  const canModerate = (m: GroupMessage) => m.sender_id === myId || ownerId === myId;

  const sendAttachment = async (file: PickedFile) => {
    if (attachBusy || !groupId) return;
    setAttachBusy(true);
    setFileError('');
    try {
      const att = await uploadChatAttachment(file, { groupId });
      sendWS({
        type: 'group.message',
        group_id: groupId,
        content: '',
        attachment_key: att.key,
        attachment_name: att.name,
        attachment_mime: att.mime,
        attachment_size: att.size,
        attachment_kind: att.kind,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now(),
          group_id: groupId,
          sender_id: myId,
          content: '',
          kind: att.kind,
          attachment_url: att.url,
          attachment_name: att.name,
          attachment_mime: att.mime,
          attachment_size: att.size,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setFileError(apiError(e, 'Не удалось отправить файл'));
    } finally {
      setAttachBusy(false);
    }
  };

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const ext = (a.uri.split('.').pop() || 'jpg').split('?')[0];
    await sendAttachment({ uri: a.uri, name: a.fileName || `media_${Date.now()}.${ext}`, mimeType: a.mimeType });
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    await sendAttachment({ uri: a.uri, name: a.name, mimeType: a.mimeType || undefined });
  };

  const senderName = (senderId: number) =>
    members.find((m) => m.id === senderId)?.username || 'Участник';

  const renderItem = ({ item, index }: { item: GroupMessage; index: number }) => {
    const prev = messages[index - 1];
    const showDay =
      !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
    const mine = item.sender_id === myId || item.id < 0;
    const isMedia = item.kind === 'image' || item.kind === 'video';
    const deleted = !!item.deleted_at;
    const isSelected = selected.has(item.id);
    const replyTarget = item.reply_to_id ? messages.find((m) => m.id === item.reply_to_id) : null;

    const pressProps = deleted ? {} : {
      onPress: () => (selectMode ? toggleSelect(item.id) : setSheetFor(item)),
      onLongPress: () => toggleSelect(item.id),
    };

    return (
      <View>
        {showDay ? (
          <View style={styles.dayWrap}>
            <Text style={styles.dayText}>{formatDay(item.created_at)}</Text>
          </View>
        ) : null}

        <Pressable {...pressProps}>
          <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther, isSelected && styles.rowSelected]}>
            <View
              style={[
                styles.bubble,
                isMedia ? styles.bubbleMedia : mine ? styles.bubbleMine : styles.bubbleOther,
              ]}>
              {!mine && !deleted ? <Text style={styles.sender}>{senderName(item.sender_id)}</Text> : null}
              {deleted ? (
                <Text style={styles.deletedText}>Сообщение удалено</Text>
              ) : (
                <>
                  {item.forwarded_from ? (
                    <Text style={styles.forwardedLabel}>Переслано от {item.forwarded_from}</Text>
                  ) : null}
                  {replyTarget ? (
                    <View style={styles.replyQuote}>
                      <Text style={styles.replyName} numberOfLines={1}>{senderName(replyTarget.sender_id)}</Text>
                      <Text style={styles.replyText} numberOfLines={1}>
                        {replyTarget.deleted_at
                          ? 'Сообщение удалено'
                          : replyTarget.content || replyTarget.attachment_name || 'Вложение'}
                      </Text>
                    </View>
                  ) : null}
                  {item.attachment_url ? (
                    <AttachmentBlock message={item} onOpen={openExternalUrl} />
                  ) : null}
                  {item.content ? (
                    <Text
                      style={[
                        styles.bubbleText,
                        mine ? styles.bubbleTextMine : styles.bubbleTextOther,
                        item.attachment_url ? styles.textAfterAtt : null,
                      ]}>
                      {item.content}
                    </Text>
                  ) : null}
                </>
              )}
              <View style={styles.bubbleFooter}>
                {item.edited_at && !deleted ? <Text style={styles.editedMark}>изменен.</Text> : null}
                <Text style={[styles.bubbleTime, mine ? styles.timeMine : styles.timeOther]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={L.text} />
        </Pressable>
        <View style={styles.headerAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatarImg} />
          ) : (
            <View style={[styles.headerAvatarImg, styles.avatarFallback]}>
              <Users size={16} color={L.muted} />
            </View>
          )}
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.headerName} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={styles.headerStatus}>
            {members.length ? `${members.length} участник(ов)` : ''}
          </Text>
        </View>
        <Pressable
          onPress={callGroup}
          style={styles.callBtn}>
          <Phone size={16} color={activeCall ? CALL_GREEN : L.muted} />
        </Pressable>
      </View>

      {activeCall ? (
        <View style={styles.callBanner}>
          <View style={styles.callBannerBody}>
            <Text style={styles.callBannerTitle} numberOfLines={1}>
              Идёт звонок · {activeCall.participants.length} чел.
            </Text>
            <Text style={styles.callBannerNames} numberOfLines={1}>
              {activeCall.participants
                .map((p) => (p.id === myId ? 'Вы' : p.display_name || p.username))
                .join(', ')}
            </Text>
          </View>
          {inCall ? (
            <Text style={styles.callBannerIn}>Вы в звонке</Text>
          ) : (
            <Pressable onPress={callGroup} style={styles.callJoinBtn}>
              <Text style={styles.callJoinText}>Подключиться</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        {loading ? (
          <ActivityIndicator color={L.accent} style={styles.loader} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>Сообщений пока нет</Text>}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {fileError ? <Text style={styles.fileError}>{fileError}</Text> : null}

        {pinnedMsg ? (
          <Pressable style={styles.pinnedBar} onPress={() => {
            const idx = messages.findIndex((m) => m.id === pinnedMsg.id);
            if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
          }}>
            <Pin size={11} color={L.accent} />
            <Text style={styles.pinnedText} numberOfLines={1}>
              {pinnedMsg.deleted_at ? 'Сообщение удалено' : pinnedMsg.content || pinnedMsg.attachment_name || 'Вложение'}
            </Text>
            <Pressable hitSlop={8} onPress={() => wsPinGroupMessage(groupId, pinnedMsg.id, false)}>
              <X size={12} color={L.muted} />
            </Pressable>
          </Pressable>
        ) : null}

        {selectMode ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkCount}>Выбрано: {selected.size}</Text>
            <View style={styles.bulkSpacer} />
            <Pressable onPress={() => {
              const texts = [...selected]
                .map((id) => messages.find((m) => m.id === id))
                .filter((m): m is GroupMessage => !!m && !m.deleted_at && !!m.content)
                .map((m) => m.content);
              if (texts.length) void Clipboard.setStringAsync(texts.join('\n'));
            }}>
              <Text style={styles.bulkAction}>Копировать</Text>
            </Pressable>
            <Pressable onPress={() => setForwarding([...selected])}>
              <Text style={styles.bulkAction}>Переслать</Text>
            </Pressable>
            <Pressable onPress={() => setDeleting([...selected])}>
              <Text style={[styles.bulkAction, styles.bulkActionDanger]}>Удалить</Text>
            </Pressable>
            <Pressable onPress={clearSelection} hitSlop={8}>
              <X size={13} color={L.muted} />
            </Pressable>
          </View>
        ) : null}

        {editing || replyTo ? (
          <View style={styles.modeBanner}>
            {editing ? <Pencil size={12} color={L.accent} /> : <Reply size={12} color={L.accent} />}
            <View style={styles.flexMin}>
              <Text style={styles.modeTitle}>
                {editing ? 'Редактирование' : `Ответ — ${replyTo ? senderName(replyTo.sender_id) : ''}`}
              </Text>
              <Text style={styles.modeText} numberOfLines={1}>
                {editing
                  ? editing.content
                  : replyTo?.content || replyTo?.attachment_name || 'Вложение'}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => {
              if (editing) { setEditing(null); setText(''); } else setReplyTo(null);
            }}>
              <X size={12} color={L.muted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <Pressable
            onPress={() => void pickMedia()}
            disabled={attachBusy}
            style={[styles.attachBtn, attachBusy && styles.attachDisabled]}>
            <ImagePlus size={18} color={attachBusy ? L.muted : L.text} />
          </Pressable>
          <Pressable
            onPress={() => void pickFile()}
            disabled={attachBusy}
            style={[styles.attachBtn, attachBusy && styles.attachDisabled]}>
            {attachBusy ? <ActivityIndicator size="small" color={L.accent} /> : <Paperclip size={18} color={L.text} />}
          </Pressable>
          <TextInput
            style={styles.input}
            value={text}
            maxLength={chatMessageLimit(user?.profile)}
            onChangeText={setText}
            placeholder="Сообщение в группу…"
            placeholderTextColor="rgba(226,226,226,0.3)"
            multiline
          />
          <Pressable
            onPress={send}
            style={[styles.send, !text.trim() && styles.sendDisabled]}>
            <Send size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MessageActionsSheet
        visible={!!sheetFor}
        actions={{
          canReply: !!sheetFor && !sheetFor.deleted_at && sheetFor.kind !== 'call',
          canEdit: !!sheetFor && sheetFor.sender_id === myId && !sheetFor.deleted_at && sheetFor.kind !== 'call',
          canPin: !!sheetFor && !sheetFor.deleted_at && canModerate(sheetFor),
          canForward: !!sheetFor && !sheetFor.deleted_at && sheetFor.kind !== 'call',
          pinned: !!sheetFor?.pinned_at,
          hasText: !!sheetFor?.content,
        }}
        onReply={() => { if (sheetFor) setReplyTo(sheetFor); setSheetFor(null); }}
        onEdit={() => {
          if (sheetFor) { setEditing(sheetFor); setText(sheetFor.content || ''); }
          setSheetFor(null);
        }}
        onPin={() => {
          if (sheetFor) wsPinGroupMessage(groupId, sheetFor.id, !sheetFor.pinned_at);
          setSheetFor(null);
        }}
        onCopy={() => {
          if (sheetFor?.content) void Clipboard.setStringAsync(sheetFor.content);
          setSheetFor(null);
        }}
        onForward={() => { if (sheetFor) setForwarding([sheetFor.id]); setSheetFor(null); }}
        onDelete={() => { if (sheetFor) setDeleting([sheetFor.id]); setSheetFor(null); }}
        onSelect={() => { if (sheetFor) toggleSelect(sheetFor.id); setSheetFor(null); }}
        onClose={() => setSheetFor(null)}
      />

      <DeleteConfirmDialog
        visible={!!deleting}
        title="Удалить сообщение"
        message={
          deleting && deleting.length > 1
            ? `Удалить ${deleting.length} сообщений?`
            : 'Удалить сообщение?'
        }
        showForAll={
          !!deleting &&
          deleting.every((id) => {
            const m = messages.find((x) => x.id === id);
            return m ? canModerate(m) : false;
          })
        }
        onConfirm={(forAll) => {
          if (!deleting) return;
          wsDeleteGroupMessages(groupId, deleting, forAll);
          if (!forAll) {
            const ids = deleting;
            setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
          }
          clearSelection();
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />

      <ForwardPickerDialog
        visible={!!forwarding}
        count={forwarding?.length || 0}
        onPick={(type, id) => {
          if (forwarding?.length) wsForwardGroup(groupId, forwarding, type, id);
          setForwarding(null);
          clearSelection();
        }}
        onClose={() => setForwarding(null)}
      />
    </SafeAreaView>
  );
}

function AttachmentBlock({ message, onOpen }: { message: GroupMessage; onOpen: (url: string) => void }) {
  const url = message.attachment_url || '';
  if (message.kind === 'image') {
    return (
      <Pressable onPress={() => onOpen(url)}>
        <Image source={{ uri: url }} style={styles.attImage} resizeMode="cover" />
      </Pressable>
    );
  }
  if (message.kind === 'video') {
    return (
      <Pressable onPress={() => onOpen(url)} style={styles.attVideo}>
        <Play size={28} color="#fff" fill="#fff" />
        <Text style={styles.attVideoText}>Видео</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={() => onOpen(url)} style={styles.attFile}>
      <FileText size={18} color={L.violet} />
      <View style={styles.flexMin}>
        <Text style={styles.attFileName} numberOfLines={1}>{message.attachment_name || 'Файл'}</Text>
        {message.attachment_size ? (
          <Text style={styles.attFileSize}>{formatBytes(message.attachment_size)}</Text>
        ) : null}
      </View>
      <Download size={14} color={L.muted} />
    </Pressable>
  );
}

const CALL_GREEN = '#34d399';

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  back: { padding: 2 },
  callBtn: { padding: 8 },
  callBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
    backgroundColor: L.cardAlt,
  },
  callBannerBody: { flex: 1, minWidth: 0 },
  callBannerTitle: { color: CALL_GREEN, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  callBannerNames: { color: 'rgba(226,226,226,0.8)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  callBannerIn: { color: 'rgba(226,226,226,0.7)', fontSize: 10, fontFamily: 'JetBrainsMono_700Bold' },
  callJoinBtn: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: CALL_GREEN, backgroundColor: 'rgba(52,211,153,0.1)' },
  callJoinText: { color: CALL_GREEN, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold' },
  headerAvatar: { position: 'relative' },
  headerAvatarImg: { width: 34, height: 34, borderRadius: 0, backgroundColor: '#000' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: L.cardAlt },
  headerBody: { flex: 1, minWidth: 0 },
  headerName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  headerStatus: { color: 'rgba(226,226,226,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },

  loader: { marginTop: 40 },
  empty: { color: 'rgba(226,226,226,0.55)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', paddingVertical: 32 },
  listContent: { paddingHorizontal: 14, paddingVertical: 10 },

  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayText: {
    color: 'rgba(226,226,226,0.55)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 0,
    overflow: 'hidden',
  },

  bubbleRow: { flexDirection: 'row', marginTop: 4 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  rowSelected: { borderRadius: 0, borderWidth: 1, borderColor: L.accent, marginVertical: 2 },
  deletedText: {
    color: 'rgba(226,226,226,0.6)',
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    fontStyle: 'italic',
  },
  forwardedLabel: {
    color: 'rgba(251,191,36,0.8)',
    fontSize: 10,
    fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  replyQuote: {
    borderLeftWidth: 2,
    borderLeftColor: L.accent,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 5,
  },
  replyName: { color: L.accent, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  replyText: { color: 'rgba(226,226,226,0.45)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  editedMark: { color: 'rgba(226,226,226,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  bubble: { maxWidth: '78%', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMedia: { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent' },
  bubbleMine: { backgroundColor: 'rgba(131,56,236,0.25)', borderBottomRightRadius: 0 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 0 },
  sender: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', marginBottom: 3 },
  bubbleText: { fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  bubbleTextMine: { color: L.text },
  bubbleTextOther: { color: 'rgba(226,226,226,0.9)' },
  textAfterAtt: { marginTop: 6 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  bubbleTime: { fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  timeMine: { color: 'rgba(226,226,226,0.4)' },
  timeOther: { color: 'rgba(226,226,226,0.6)' },

  attImage: { width: 220, height: 165, borderRadius: 0, backgroundColor: L.cardAlt },
  attVideo: { width: 220, height: 150, borderRadius: 0, backgroundColor: 'rgba(131,56,236,0.3)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  attVideoText: { color: '#fff', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  attFile: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10, minWidth: 200 },
  attFileName: { color: 'rgba(244,244,246,0.85)', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  attFileSize: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  flexMin: { flex: 1, minWidth: 0 },

  fileError: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', paddingHorizontal: 12, paddingBottom: 4 },

  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,45,143,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: L.border,
  },
  pinnedText: { flex: 1, color: 'rgba(226,226,226,0.55)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },

  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,45,143,0.1)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: L.border,
  },
  bulkCount: { color: 'rgba(226,226,226,0.85)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  bulkSpacer: { flex: 1 },
  bulkAction: { color: 'rgba(226,226,226,0.7)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  bulkActionDanger: { color: L.danger },

  modeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: -4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 2,
    borderLeftColor: L.accent,
    backgroundColor: 'rgba(255,45,143,0.08)',
  },
  modeTitle: { color: L.accent, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  modeText: { color: 'rgba(226,226,226,0.5)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachDisabled: { opacity: 0.5 },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#16161a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#E2E2E2',
    fontSize: 13, fontFamily: 'JetBrainsMono_400Regular',
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: L.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.3 },
}));
