import { themedStyles } from '@/theme/themedStyles';
import { openExternalUrl } from '@/utils/openUrl';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
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
  Video,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';

import { startCall } from '@/api/call';
import {
  getMessages,
  sendWS,
  uploadChatAttachment,
  wsDeleteMessages,
  wsEditMessage,
  wsForwardDM,
  wsPinMessage,
  type ChatMessage,
  type PickedFile,
} from '@/api/chat';
import { useChatEvents, useChatState } from '@/hooks/use-chat';
import { usePresence } from '@/api/presence';
import { useAuth } from '@/context/AuthContext';
import { chatMessageLimit } from '@/api/subscriptions';
import { apiError } from '@/utils/apiError';
import { callSubLabel, callTitle, formatDay, formatDuration, formatTime } from '@/utils/chatFormat';
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

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string; username?: string; otherId?: string; avatar?: string }>();
  const convId = Number(params.id);
  const otherId = Number(params.otherId);
  const { user } = useAuth();
  const myId = user?.id ?? 0;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const presence = usePresence(otherId);
  const online = !!presence?.online;
  const playing = presence?.playing ?? null;
  const [attachBusy, setAttachBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // последний отправленный текст: вернём в поле, если сервер отклонил сообщение (флуд)
  const lastSent = useRef('');

  // Действия над сообщениями: тап — меню, долгое нажатие — выделение
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sheetFor, setSheetFor] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState<number[] | null>(null);

  useChatState(setConnected);

  useChatEvents((data) => {
    switch (data.type) {
      case 'chat.message': {
        const msg = data.message as ChatMessage | undefined;
        if (msg && msg.conversation_id === convId) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          sendWS({ type: 'chat.read', conversation_id: convId });
        }
        break;
      }
      // Собеседник прочитал: галочки обновляем сразу, а не при повторном входе в чат
      case 'chat.read': {
        if (data.conversation_id !== convId || data.user_id === myId) break;
        const now = new Date().toISOString();
        setMessages((prev) => prev.map((m) => (m.sender_id === myId && !m.read_at ? { ...m, read_at: now } : m)));
        break;
      }
      case 'chat.rate_limited': {
        if (data.conversation_id !== convId) break;
        if (data.action !== 'edit' && lastSent.current) {
          const back = lastSent.current;
          lastSent.current = '';
          setText((cur) => cur || back);
        }
        Alert.alert('Сообщение не отправлено', String(data.error || 'Слишком часто — подождите немного'));
        break;
      }
      case 'chat.typing': {
        if (data.conversation_id === convId && data.user_id !== myId) {
          setTyping(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 3000);
        }
        break;
      }
      case 'chat.message.updated': {
        const upd = data.message as { id: number; content: string; edited_at?: string } | undefined;
        if (upd && data.conversation_id === convId) {
          setMessages((prev) => prev.map((m) => (m.id === upd.id ? { ...m, content: upd.content, edited_at: upd.edited_at } : m)));
        }
        break;
      }
      case 'chat.message.deleted': {
        const ids = (data.message_ids as number[]) || [];
        if (data.conversation_id === convId && ids.length) {
          const nowIso = new Date().toISOString();
          setMessages((prev) => prev.map((m) => (ids.includes(m.id)
            ? { ...m, content: '', deleted_at: nowIso, attachment_url: undefined, attachment_name: undefined }
            : m)));
        }
        break;
      }
      case 'chat.message.hidden': {
        const ids = (data.message_ids as number[]) || [];
        if (data.conversation_id === convId && ids.length) {
          setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
        }
        break;
      }
      case 'chat.message.pinned': {
        if (data.conversation_id === convId) {
          const pinnedNow = !!data.pinned;
          setMessages((prev) => prev.map((m) => (m.id === data.message_id
            ? { ...m, pinned_at: pinnedNow ? new Date().toISOString() : null }
            : m)));
        }
        break;
      }
    }
  });

  useEffect(() => {
    if (!convId) return;
    let cancelled = false;
    getMessages(convId)
      .then((list) => {
        if (!cancelled) setMessages(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // queue: экран часто открывают раньше, чем поднялось соединение
    sendWS({ type: 'chat.read', conversation_id: convId }, { queue: true });
    return () => {
      cancelled = true;
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [convId]);

  const send = () => {
    const content = text.trim();
    if (!content || !connected) return;
    // Режим редактирования
    if (editing) {
      const id = editing.id;
      const original = editing.content;
      setEditing(null);
      setText('');
      if (content !== original) {
        wsEditMessage(convId, id, content);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, edited_at: new Date().toISOString() } : m)));
      }
      return;
    }
    const replyId = replyTo && replyTo.id > 0 ? replyTo.id : undefined;
    sendWS({ type: 'chat.message', conversation_id: convId, content, ...(replyId ? { reply_to_id: replyId } : {}) });
    lastSent.current = content;
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
  const senderName = (id: number) => (id === myId ? 'Вы' : params.username || 'Собеседник');

  const sheetMsg = sheetFor;
  const sheetCanEdit = !!sheetMsg && sheetMsg.sender_id === myId && !sheetMsg.deleted_at && sheetMsg.kind !== 'call';
  const sheetCanPin = !!sheetMsg && !sheetMsg.deleted_at;
  const sheetHasText = !!sheetMsg?.content;

  const onChangeText = (value: string) => {
    setText(value);
    if (connected && value.trim()) sendWS({ type: 'chat.typing', conversation_id: convId });
  };

  const sendAttachment = async (file: PickedFile) => {
    if (attachBusy || !convId) return;
    setAttachBusy(true);
    setFileError('');
    try {
      const att = await uploadChatAttachment(file, { conversationId: convId });
      sendWS({
        type: 'chat.message',
        conversation_id: convId,
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
          conversation_id: convId,
          sender_id: myId,
          content: '',
          kind: att.kind,
          attachment_url: att.url,
          attachment_name: att.name,
          attachment_mime: att.mime,
          attachment_size: att.size,
          read_at: null,
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

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const prev = messages[index - 1];
    const showDay =
      !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
    const mine = item.sender_id === myId || item.id < 0;
    const isMedia = item.kind === 'image' || item.kind === 'video';
    const deleted = !!item.deleted_at;
    const isSelected = selected.has(item.id);
    const replyTarget = item.reply_to_id ? messages.find((m) => m.id === item.reply_to_id) : null;

    // Тап: в режиме выделения — переключить, иначе открыть меню. Долгое нажатие — выделить.
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

        {item.kind === 'call' ? (
          <Pressable {...(deleted ? {} : { onLongPress: () => toggleSelect(item.id) })}>
            <View style={[styles.bubbleRow, isSelected && styles.rowSelected]}>
              <CallBubble message={item} outgoing={item.sender_id === myId} />
            </View>
          </Pressable>
        ) : (
          <Pressable {...pressProps}>
            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther, isSelected && styles.rowSelected]}>
              <View
                style={[
                  styles.bubble,
                  isMedia ? styles.bubbleMedia : mine ? styles.bubbleMine : styles.bubbleOther,
                ]}>
                {deleted ? (
                  <Text style={styles.deletedText}>Сообщение удалено</Text>
                ) : (
                  <>
                    {item.forwarded_from ? (
                      <Text style={styles.forwardedLabel}>Переслано от {item.forwarded_from}</Text>
                    ) : null}
                    {replyTarget ? (
                      <View style={styles.replyQuote}>
                        <Text style={styles.replyName} numberOfLines={1}>
                          {senderName(replyTarget.sender_id)}
                        </Text>
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
                      <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextOther, item.attachment_url ? styles.textAfterAtt : null]}>
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
                  {mine && !deleted ? (
                    <Text style={styles.checks}>
                      {item.read_at ? '✓✓' : item.id > 0 ? '✓' : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Pressable>
        )}
      </View>
    );
  };

  const status = typing
    ? 'печатает…'
    : playing
      ? `Играет в ${playing}`
      : online
        ? 'В сети'
        : connected
          ? 'Не в сети'
          : 'нет соединения';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={L.text} />
        </Pressable>

        <View style={styles.headerAvatar}>
          {params.avatar ? (
            <Image source={{ uri: params.avatar }} style={styles.headerAvatarImg} />
          ) : (
            <View style={[styles.headerAvatarImg, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{(params.username || '?')[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={[styles.headerDot, online ? styles.headerDotOnline : styles.headerDotOffline]} />
        </View>

        <View style={styles.headerBody}>
          <Text style={styles.headerName} numberOfLines={1}>
            {params.username || 'Чат'}
          </Text>
          <Text
            style={[
              styles.headerStatus,
              typing ? styles.statusAccent : playing ? styles.statusAccent : online ? styles.statusOnline : null,
            ]}>
            {status}
          </Text>
        </View>

        {!!otherId && (
          <>
            <Pressable
              onPress={() => startCall({ id: otherId, username: params.username || 'Пользователь' })}
              style={styles.callBtn}>
              <Phone size={16} color={L.muted} />
            </Pressable>
            <Pressable
              onPress={() => startCall({ id: otherId, username: params.username || 'Пользователь' }, true)}
              style={styles.callBtn}>
              <Video size={16} color={L.muted} />
            </Pressable>
          </>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        {loading ? (
          <ActivityIndicator color={L.accent} style={styles.loader} />
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
            <Pressable hitSlop={8} onPress={() => wsPinMessage(convId, pinnedMsg.id, false)}>
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
                .filter((m): m is ChatMessage => !!m && !m.deleted_at && !!m.content)
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
            onChangeText={onChangeText}
            placeholder="Сообщение…"
            placeholderTextColor="rgba(226,226,226,0.3)"
            multiline
          />
          <Pressable
            onPress={send}
            style={[styles.send, (!text.trim() || !connected) && styles.sendDisabled]}>
            <Send size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MessageActionsSheet
        visible={!!sheetFor}
        actions={{
          canReply: !!sheetMsg && !sheetMsg.deleted_at && sheetMsg.kind !== 'call',
          canEdit: sheetCanEdit,
          canPin: sheetCanPin,
          canForward: !!sheetMsg && !sheetMsg.deleted_at && sheetMsg.kind !== 'call',
          pinned: !!sheetMsg?.pinned_at,
          hasText: sheetHasText,
        }}
        onReply={() => { if (sheetFor) setReplyTo(sheetFor); setSheetFor(null); }}
        onEdit={() => {
          if (sheetFor) { setEditing(sheetFor); setText(sheetFor.content || ''); }
          setSheetFor(null);
        }}
        onPin={() => {
          if (sheetFor) wsPinMessage(convId, sheetFor.id, !sheetFor.pinned_at);
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
        showForAll
        onConfirm={(forAll) => {
          if (!deleting) return;
          wsDeleteMessages(convId, deleting, forAll);
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
          if (forwarding?.length) wsForwardDM(convId, forwarding, type, id);
          setForwarding(null);
          clearSelection();
        }}
        onClose={() => setForwarding(null)}
      />
    </SafeAreaView>
  );
}

function AttachmentBlock({ message, onOpen }: { message: ChatMessage; onOpen: (url: string) => void }) {
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

function CallBubble({ message, outgoing }: { message: ChatMessage; outgoing: boolean }) {
  const duration = message.call_duration || 0;
  return (
    <View style={[styles.bubbleRow, outgoing ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      <View style={[styles.callCard, outgoing ? styles.callCardMine : styles.callCardOther]}>
        <View style={styles.callTitleRow}>
          <Phone size={15} color="#fff" />
          <Text style={styles.callTitle} numberOfLines={1}>
            {callTitle(message.call_status || '', outgoing)}
          </Text>
        </View>
        <View style={styles.callSubRow}>
          {outgoing ? (
            <ArrowUpRight size={13} color="#fbbf24" />
          ) : (
            <ArrowDownLeft size={13} color="#34d399" />
          )}
          {duration > 0 ? (
            <Text style={styles.callDuration}>{formatDuration(duration)}</Text>
          ) : (
            <Text style={styles.callSub}>{callSubLabel(message.call_status || '')}</Text>
          )}
          <Text style={styles.callTime}>{formatTime(message.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

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
  headerAvatar: { position: 'relative' },
  headerAvatarImg: { width: 34, height: 34, borderRadius: 0, backgroundColor: '#000' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: L.cardAlt },
  avatarText: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', },
  headerDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: L.bg,
  },
  headerDotOnline: { backgroundColor: '#22c55e' },
  headerDotOffline: { backgroundColor: 'rgba(226,226,226,0.2)' },
  headerBody: { flex: 1, minWidth: 0 },
  headerName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  headerStatus: { color: 'rgba(226,226,226,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  statusAccent: { color: L.accent },
  statusOnline: { color: '#22c55e' },
  callBtn: { padding: 8 },

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
  bubbleText: { fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  bubbleTextMine: { color: L.text },
  bubbleTextOther: { color: 'rgba(226,226,226,0.9)' },
  textAfterAtt: { marginTop: 6 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  bubbleTime: { fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  timeMine: { color: 'rgba(226,226,226,0.4)' },
  timeOther: { color: 'rgba(226,226,226,0.6)' },
  checks: { fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', color: 'rgba(226,226,226,0.4)' },

  attImage: { width: 220, height: 165, borderRadius: 0, backgroundColor: L.cardAlt },
  attVideo: { width: 220, height: 150, borderRadius: 0, backgroundColor: 'rgba(131,56,236,0.3)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  attVideoText: { color: '#fff', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  attFile: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10, minWidth: 200 },
  attFileName: { color: 'rgba(244,244,246,0.85)', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  attFileSize: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  flexMin: { flex: 1, minWidth: 0 },

  callCard: {
    maxWidth: '78%',
    minWidth: 190,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(131,56,236,0.3)',
  },
  callCardMine: { borderBottomRightRadius: 0 },
  callCardOther: { borderBottomLeftRadius: 0 },
  callTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callTitle: { color: '#fff', fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', flexShrink: 1 },
  callSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  callDuration: { color: 'rgba(226,226,226,0.6)', fontSize: 11, fontFamily: 'monospace' },
  callSub: { color: 'rgba(226,226,226,0.6)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  callTime: { color: 'rgba(226,226,226,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginLeft: 'auto' },

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
