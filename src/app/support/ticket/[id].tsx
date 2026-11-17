import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CircleCheck,
  Clock,
  Headset,
  Send,
  User,
  UserCheck,
} from 'lucide-react-native';

import {
  addTicketMessage,
  claimTicket,
  closeTicket,
  getTicket,
  setTicketStatus,
  type SupportMessage,
  type SupportTicket,
  type TicketStatus,
} from '@/api/support';
import { Avatar } from '@/components/settings/ui';
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_META, formatDate } from '@/components/support/meta';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';

// Картинки из нашего хранилища — картинкой (приложение прикладывает файл строкой
// «Вложение: <ссылка>»); чужие адреса не встраиваем — только ссылкой.
const URL_RE = /https?:\/\/[^\s<>"']+/g;
function isTrustedImage(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (/^storage\.yandexcloud\.net$/i.test(u.hostname) || /(^|\.)lustrehub\.pro$/i.test(u.hostname))
      && /\.(png|jpe?g|gif|webp)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function MessageBody({ text }: { text: string }) {
  // картинка разворачивается на весь экран, а не открывается в браузере
  const [open, setOpen] = useState<string | null>(null);
  const images: string[] = [];
  const rest = text.replace(URL_RE, (raw) => {
    const url = raw.replace(/[.,;:!?)]+$/, '');
    if (!isTrustedImage(url)) return raw;
    images.push(url);
    return raw.slice(url.length);
  }).replace(/Вложение:\s*$/gm, '').trim();
  return (
    <>
      {!!rest && <Text style={styles.bubbleText} selectable>{rest}</Text>}
      {images.map((url) => (
        <Pressable key={url} onPress={() => setOpen(url)}>
          <Image source={{ uri: url }} style={styles.attImage} resizeMode="contain" />
        </Pressable>
      ))}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(null)} accessibilityLabel="Закрыть">
          {open ? <Image source={{ uri: open }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

export default function TicketChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'manager';

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setTicket(await getTicket(ticketId));
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось открыть обращение'));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (ticket?.messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [ticket?.messages?.length]);

  const refresh = async () => {
    setTicket(await getTicket(ticketId));
  };

  const send = async () => {
    if (!ticket || !draft.trim()) return;
    setBusy(true);
    try {
      await addTicketMessage(ticket.id, draft.trim());
      setDraft('');
      await refresh();
    } catch (e) {
      setError(apiError(e, 'Не удалось отправить сообщение'));
    } finally {
      setBusy(false);
    }
  };

  const doClose = async () => {
    if (!ticket) return;
    setCloseOpen(false);
    setBusy(true);
    try {
      await closeTicket(ticket.id);
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!ticket) return;
    setBusy(true);
    try {
      await claimTicket(ticket.id);
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (s: TicketStatus) => {
    if (!ticket) return;
    setBusy(true);
    try {
      await setTicketStatus(ticket.id, s);
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const statusMeta = STATUS_META[ticket?.status || 'open'] || STATUS_META.open;
  const closed = ticket?.status === 'closed';

  const renderMessage = (m: SupportMessage) => {
    const mine = isStaff ? m.is_staff : !m.is_staff;
    const authorName =
      m.author?.profile?.display_name ||
      m.author?.username ||
      (m.is_staff ? 'Поддержка' : 'Вы');
    return (
      <View key={m.id} style={[styles.msgRow, mine && styles.msgRowMine]}>
        <Avatar url={m.author?.profile?.avatar_url} name={authorName} size={30} />
        <View style={[styles.msgCol, mine && styles.msgColMine]}>
          <View style={styles.msgHead}>
            <Text style={[styles.msgAuthor, m.is_staff && styles.msgAuthorStaff]}>
              {m.is_staff ? 'Поддержка' : authorName}
            </Text>
            <Text style={styles.msgDate}>{formatDate(m.created_at)}</Text>
          </View>
          <View style={[styles.bubble, m.is_staff ? styles.bubbleStaff : styles.bubbleUser]}>
            <MessageBody text={m.content} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {ticket?.subject || 'Обращение'}
        </Text>
        {ticket ? (
          <View style={[styles.chip, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
            <Text style={[styles.chipText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <DataState loading={loading} error={error && !ticket ? error : ''} onRetry={() => void load()} />

          {ticket ? (
            <>
              {isStaff ? (
                <View style={styles.infoCard}>
                  <Headset size={20} color={L.violet} />
                  <View style={styles.infoBody}>
                    <Text style={styles.infoTitle} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <Text style={styles.infoSub} numberOfLines={2}>
                      {ticket.author?.profile?.display_name || ticket.author?.username} · {ticket.email || 'без email'} ·{' '}
                      {CATEGORY_LABEL[ticket.category] || 'Другое'}
                      {ticket.priority !== 'normal'
                        ? ` · приоритет: ${(PRIORITY_LABEL[ticket.priority] || ticket.priority).toLowerCase()}`
                        : ''}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.infoCard}>
                  <Headset size={20} color={L.accent} />
                  <View style={styles.infoBody}>
                    <Text style={styles.infoTitle} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <Text style={styles.infoSub}>Личный диалог с поддержкой Lustre</Text>
                  </View>
                </View>
              )}

              {/* Действия со статусом (как TicketStatusActions на десктопе) */}
              {isStaff ? (
                <View style={styles.actions}>
                  {ticket.assignee?.id !== user?.id ? (
                    <ActionBtn label="Принять в работу" onPress={() => void claim()} busy={busy} icon={<UserCheck size={13} color={L.text} />} />
                  ) : null}
                  <ActionBtn
                    label="В работе"
                    onPress={() => void changeStatus('in_progress')}
                    busy={busy || ticket.status === 'in_progress'}
                    icon={<User size={13} color="#FFB020" />}
                  />
                  <ActionBtn
                    label="Решено"
                    onPress={() => void changeStatus('resolved')}
                    busy={busy || ticket.status === 'resolved'}
                    icon={<CircleCheck size={13} color={L.success} />}
                  />
                  <ActionBtn
                    label="Открыто"
                    onPress={() => void changeStatus('open')}
                    busy={busy || ticket.status === 'open'}
                    icon={<Clock size={13} color="#22D3EE" />}
                  />
                  <ActionBtn
                    label="Закрыть"
                    onPress={() => void changeStatus('closed')}
                    busy={busy || ticket.status === 'closed'}
                    danger
                  />
                </View>
              ) : null}

              <View style={styles.thread}>
                {(ticket.messages || []).map(renderMessage)}
              </View>

              {/* Ввод */}
              {closed && !isStaff ? (
                <View style={styles.closedBox}>
                  <Text style={styles.closedText}>Обращение закрыто</Text>
                </View>
              ) : (
                <>
                  <View style={styles.composer}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      placeholder={isStaff ? 'Ответить пользователю...' : 'Написать в поддержку...'}
                      placeholderTextColor={L.muted}
                      style={styles.composerInput}
                    />
                    <Pressable
                      onPress={() => void send()}
                      disabled={busy || !draft.trim()}
                      style={[styles.sendBtn, (busy || !draft.trim()) && styles.sendBtnDisabled]}>
                      <Send size={18} color="#fff" />
                    </Pressable>
                  </View>
                  {!isStaff ? (
                    <Pressable onPress={() => setCloseOpen(true)} style={styles.closeLink} hitSlop={6}>
                      <Text style={styles.closeLinkText}>Закрыть обращение</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {error && ticket ? (
            <Text style={styles.err}>{error}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Подтверждение закрытия */}
      <Modal visible={closeOpen} transparent animationType="fade" onRequestClose={() => setCloseOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Закрыть обращение</Text>
            <Text style={styles.modalText}>Обращение будет закрыто. Продолжить?</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCloseOpen(false)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>Отмена</Text>
              </Pressable>
              <Pressable onPress={() => void doClose()} style={[styles.modalBtn, styles.modalBtnDanger]}>
                <Text style={styles.modalBtnText}>Закрыть</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionBtn({
  label,
  onPress,
  busy,
  icon,
  danger,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.actionBtn, danger && styles.actionBtnDanger, busy && styles.actionBtnBusy]}>
      {icon}
      <Text style={[styles.actionBtnText, danger && styles.actionBtnTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { flex: 1, color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  chip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  chipText: { fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
  },
  infoBody: { flex: 1, minWidth: 0 },
  infoTitle: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', },
  infoSub: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: L.card,
  },
  actionBtnDanger: { borderColor: 'rgba(255,77,79,0.45)' },
  actionBtnBusy: { opacity: 0.5 },
  actionBtnText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  actionBtnTextDanger: { color: L.danger },
  thread: { gap: 14 },
  msgRow: { flexDirection: 'row', gap: 10 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgCol: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  msgColMine: { alignItems: 'flex-end' },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  msgAuthor: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  msgAuthorStaff: { color: L.violet },
  msgDate: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  bubble: { maxWidth: '85%', borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleStaff: { backgroundColor: 'rgba(131,56,236,0.08)', borderColor: 'rgba(131,56,236,0.4)' },
  bubbleUser: { backgroundColor: L.cardAlt, borderColor: L.border },
  bubbleText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  attImage: { width: 220, height: 160, marginTop: 6, backgroundColor: '#000' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  closedBox: {
    backgroundColor: 'rgba(255,176,32,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,32,0.4)',
    borderRadius: 0,
    padding: 14,
    alignItems: 'center',
  },
  closedText: { color: '#FFB020', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  composerInput: {
    flex: 1,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: L.text,
    fontSize: 14, fontFamily: 'JetBrainsMono_400Regular',
    maxHeight: 120,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 0,
    backgroundColor: L.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  closeLink: { alignSelf: 'flex-end', padding: 4 },
  closeLinkText: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  err: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 20,
  },
  modalTitle: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', marginBottom: 8 },
  modalText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginBottom: 18 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 0, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { borderWidth: 1, borderColor: L.border },
  modalBtnGhostText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  modalBtnDanger: { backgroundColor: L.danger },
  modalBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
}));
