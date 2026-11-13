import api from './client';
import { WS_CHAT_URL } from './config';

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  kind?: 'text' | 'call' | 'image' | 'video' | 'file' | string;
  call_status?: string;
  call_duration?: number;
  attachment_url?: string;
  attachment_name?: string;
  attachment_mime?: string;
  attachment_size?: number;
  read_at: string | null;
  created_at: string;
  // Редактирование / удаление / закреп / пересылка
  reply_to_id?: number | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  pinned_at?: string | null;
  forwarded_from?: string;
}

export type ChatAttachmentKind = 'image' | 'video' | 'file';

export interface ChatAttachment {
  key: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: ChatAttachmentKind;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

/** Загрузка вложения в чат (диалог или группа) в приватный бакет. */
export async function uploadChatAttachment(
  file: PickedFile,
  target: { conversationId?: number; groupId?: number },
): Promise<ChatAttachment> {
  const fd = new FormData();
  fd.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  const qs = target.groupId ? `group_id=${target.groupId}` : `conversation_id=${target.conversationId}`;
  const res = await api.post(`/upload/chat?${qs}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as ChatAttachment;
}

export interface ChatConversation {
  id: number;
  other_user: { id: number; username: string; avatar_url: string };
  last_message: ChatMessage | null;
  unread: number;
}

export async function getConversations(): Promise<ChatConversation[]> {
  const res = await api.get('/chat/conversations');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getOrCreateConversation(userId: number): Promise<number> {
  const res = await api.post(`/chat/conversation/${userId}`);
  return res.data.conversation_id;
}

export async function getMessages(conversationId: number, limit = 50): Promise<ChatMessage[]> {
  const res = await api.get(`/chat/messages/${conversationId}?limit=${limit}`);
  return Array.isArray(res.data) ? res.data : [];
}

// --- WebSocket ---

type ChatEventHandler = (data: { type?: string } & Record<string, unknown>) => void;

let ws: WebSocket | null = null;
let keepalive: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connecting = false;
const handlers = new Set<ChatEventHandler>();
const stateHandlers = new Set<(connected: boolean) => void>();
let connected = false;

export function onChatEvent(handler: ChatEventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function onChatState(handler: (connected: boolean) => void): () => void {
  stateHandlers.add(handler);
  handler(connected);
  return () => stateHandlers.delete(handler);
}

function emit(data: { type?: string } & Record<string, unknown>) {
  handlers.forEach((h) => {
    try {
      h(data);
    } catch (e) {
      console.error('[chat] handler error', e);
    }
  });
}

// Важные сигналы (звонки), отправленные без соединения: уходят сразу после переподключения
const OUTBOX_TTL = 30_000;
let outbox: { payload: Record<string, unknown>; at: number }[] = [];

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  stateHandlers.forEach((h) => h(value));
}

export function isChatConnected(): boolean {
  return connected;
}

export function connectChat() {
  if (connecting || (ws && ws.readyState <= 1)) return;
  connecting = true;

  api
    .get('/chat/ws-ticket')
    .then(({ data }) => {
      connecting = false;
      ws = new WebSocket(`${WS_CHAT_URL}?ticket=${data.ticket}`);

      ws.onopen = () => {
        const pending = outbox.filter((m) => Date.now() - m.at < OUTBOX_TTL);
        outbox = [];
        pending.forEach((m) => ws?.send(JSON.stringify(m.payload)));
        setConnected(true);
        // переподключение: сервер забыл подписки (голосовые каналы и т.п.) — модули их восстанавливают
        emit({ type: '__open' });
        keepalive = setInterval(() => {
          if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25000);
      };

      ws.onmessage = (e) => {
        try {
          emit(JSON.parse(e.data as string));
        } catch {
          // ignore non-JSON
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (keepalive) clearInterval(keepalive);
        ws = null;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectChat, 3000);
      };

      ws.onerror = () => ws?.close();
    })
    .catch(() => {
      connecting = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectChat, 5000);
    });
}

export function disconnectChat() {
  if (keepalive) clearInterval(keepalive);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  setConnected(false);
  ws?.close();
  ws = null;
}

/** queue: не терять сигнал при обрыве — отправить после переподключения (до 30 с) */
export function sendWS(payload: Record<string, unknown>, opts?: { queue?: boolean }): boolean {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  if (opts?.queue) {
    outbox.push({ payload, at: Date.now() });
    connectChat();
  }
  return false;
}

// --- Действия над сообщениями (backend: controllers/chat_actions.go) ---

export function wsEditMessage(conversationId: number, messageId: number, content: string) {
  sendWS({ type: 'chat.edit', conversation_id: conversationId, message_id: messageId, content });
}

export function wsDeleteMessages(conversationId: number, messageIds: number[], forAll: boolean) {
  sendWS({ type: 'chat.delete', conversation_id: conversationId, message_ids: messageIds, for_all: forAll });
}

export function wsPinMessage(conversationId: number, messageId: number, pinned: boolean) {
  sendWS({ type: 'chat.pin', conversation_id: conversationId, message_id: messageId, pinned });
}

export function wsForwardDM(sourceConversationId: number, messageIds: number[], targetType: 'dm' | 'group', targetId: number) {
  sendWS({ type: 'chat.forward', conversation_id: sourceConversationId, message_ids: messageIds, target_type: targetType, target_id: targetId });
}

export function wsDeleteConversation(conversationId: number, forAll: boolean) {
  sendWS({ type: 'chat.conversation.delete', conversation_id: conversationId, for_all: forAll });
}

export function wsEditGroupMessage(groupId: number, messageId: number, content: string) {
  sendWS({ type: 'group.edit', group_id: groupId, message_id: messageId, content });
}

export function wsDeleteGroupMessages(groupId: number, messageIds: number[], forAll: boolean) {
  sendWS({ type: 'group.delete', group_id: groupId, message_ids: messageIds, for_all: forAll });
}

export function wsPinGroupMessage(groupId: number, messageId: number, pinned: boolean) {
  sendWS({ type: 'group.pin', group_id: groupId, message_id: messageId, pinned });
}

export function wsForwardGroup(sourceGroupId: number, messageIds: number[], targetType: 'dm' | 'group', targetId: number) {
  sendWS({ type: 'group.forward', group_id: sourceGroupId, message_ids: messageIds, target_type: targetType, target_id: targetId });
}
