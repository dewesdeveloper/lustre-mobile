// Голосовые каналы сообществ — как в лаунчере (и в Discord): постоянные комнаты, в которые
// заходишь и выходишь сам. Медиа — LiveKit (комната канала), присутствие «кто в каком канале,
// мьют/deafen» — WS-события voice.* (backend: controllers/voice_channels.go).
// Мобильная версия — только звук: камеру и демонстрацию экрана в канале включают в лаунчере.

import { useSyncExternalStore } from 'react';

import api from './client';
import { joinByInvite } from './community';
import { onChatEvent, sendWS } from './chat';
import * as lk from './livekitRoom';
import { getCallState } from './call';
import { getGroupCallState } from './groupCall';
import { registerVoiceLeave } from './voiceBridge';

export interface VoiceUser {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_pro?: boolean;
}

export interface VoiceMember {
  user_id: number;
  user: VoiceUser;
  channel_id: number;
  community_id: number;
  self_mute: boolean;
  self_deaf: boolean;
  server_mute: boolean;
  video: boolean;
  stream: boolean;
  joined_at: string;
}

export interface VoiceChannelInfo {
  id: number;
  community_id: number;
  kind: 'voice' | string;
  name: string;
  position: number;
  user_limit: number;
}

/** Сообщение текстового чата голосового канала */
export interface VoiceChatMessage {
  ID: number;
  CreatedAt: string;
  channel_id: number;
  author_id: number;
  content: string;
  author?: { username?: string; profile?: { display_name?: string; avatar_url?: string } };
}

/** Входящее приглашение в голосовой канал */
export interface VoiceInvite {
  channel: VoiceChannelInfo;
  community_id: number;
  community_name: string;
  by?: VoiceUser;
  /** Только от владельца приватного сообщества: приглашённый вступает по этому коду */
  invite_code?: string;
  at: number;
}

export interface CommunityVoice {
  channels: VoiceChannelInfo[];
  members: VoiceMember[];
  canManage: boolean;
  canJoin: boolean;
  livekit: boolean;
  loaded: boolean;
}

export type VoiceStatus = 'idle' | 'connecting' | 'connected';

export interface VoiceState {
  selfId: number;
  status: VoiceStatus;
  channelId: number | null;
  communityId: number | null;
  channelName: string;
  communityName: string;
  selfMute: boolean;
  selfDeaf: boolean;
  serverMute: boolean;
  /** user_id тех, кто говорит прямо сейчас */
  speaking: number[];
  localSpeaking: boolean;
  startedAt: number | null;
  notice: string | null;
  invite: VoiceInvite | null;
  communities: Record<number, CommunityVoice>;
}

const initial: VoiceState = {
  selfId: 0, status: 'idle', channelId: null, communityId: null, channelName: '', communityName: '',
  selfMute: false, selfDeaf: false, serverMute: false, speaking: [], localSpeaking: false,
  startedAt: null, notice: null, invite: null, communities: {},
};

let state: VoiceState = { ...initial };
const listeners = new Set<() => void>();

function setState(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getVoiceState(): VoiceState {
  return state;
}

export function subscribeVoice(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Состояние голосовых каналов для компонентов */
export function useVoice(): VoiceState {
  return useSyncExternalStore(subscribeVoice, getVoiceState);
}

let myId = 0;

// ---------------- Присутствие в каналах сообществ ----------------

const watched = new Map<number, number>(); // community_id -> число наблюдателей

function patchCommunity(id: number, fn: (c: CommunityVoice) => CommunityVoice) {
  const cur = state.communities[id] ?? { channels: [], members: [], canManage: false, canJoin: false, livekit: false, loaded: false };
  setState({ communities: { ...state.communities, [id]: fn(cur) } });
}

export async function refreshChannels(communityId: number): Promise<void> {
  try {
    const { data } = await api.get(`/communities/${communityId}/channels`);
    patchCommunity(communityId, () => ({
      channels: data.channels || [],
      members: data.voice_states || [],
      canManage: !!data.can_manage,
      canJoin: !!data.can_join,
      livekit: !!data.livekit,
      loaded: true,
    }));
  } catch {
    patchCommunity(communityId, (c) => ({ ...c, loaded: true }));
  }
}

/** Экран сообщества открыт: грузим каналы и подписываемся на живые обновления. */
export function watchCommunity(communityId: number): () => void {
  watched.set(communityId, (watched.get(communityId) ?? 0) + 1);
  void refreshChannels(communityId);
  sendWS({ type: 'voice.subscribe', community_id: communityId });
  return () => {
    const n = (watched.get(communityId) ?? 1) - 1;
    if (n > 0) {
      watched.set(communityId, n);
      return;
    }
    watched.delete(communityId);
    // оставаясь в канале сообщества, продолжаем получать его состояния
    if (state.communityId !== communityId) sendWS({ type: 'voice.unsubscribe', community_id: communityId });
  };
}

function upsertMember(communityId: number, userId: number, m: VoiceMember | null) {
  patchCommunity(communityId, (c) => {
    const rest = c.members.filter((x) => x.user_id !== userId);
    return { ...c, members: m ? [...rest, m] : rest };
  });
  // своё состояние с сервера: серверный мьют
  if (userId === myId && m && state.channelId === m.channel_id && m.server_mute !== state.serverMute) {
    setState({ serverMute: m.server_mute });
    if (m.server_mute) {
      void lk.setMicEnabled(false);
      notice('Модератор выключил вам микрофон');
    } else {
      void lk.setMicEnabled(!state.selfMute);
      notice('Модератор снова разрешил микрофон');
    }
  }
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;
function notice(text: string) {
  setState({ notice: text });
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => setState({ notice: null }), 4500);
}
export function clearVoiceNotice() {
  setState({ notice: null });
}

// ---------------- Подключение ----------------

let joinSeq = 0;

function callBusy(): boolean {
  return getCallState().status !== 'idle' || getGroupCallState().status !== 'idle';
}

/** Зайти в голосовой канал (из другого — переходим, как в Discord). */
export async function joinVoiceChannel(channel: VoiceChannelInfo, communityName: string): Promise<void> {
  if (state.channelId === channel.id && state.status !== 'idle') return;
  if (callBusy()) {
    notice('Сначала завершите текущий звонок');
    return;
  }
  const seq = ++joinSeq;
  if (state.status !== 'idle') await teardown(false);

  setState({
    status: 'connecting', channelId: channel.id, communityId: channel.community_id,
    channelName: channel.name, communityName, notice: null, serverMute: false, speaking: [], localSpeaking: false,
  });
  sendWS({ type: 'voice.subscribe', community_id: channel.community_id });

  let creds: lk.LiveKitCreds | null = null;
  try {
    const { data } = await api.post('/calls/token', { channel_id: channel.id });
    if (data?.token && data?.url) creds = data;
  } catch (e: unknown) {
    if (seq !== joinSeq) return;
    resetIdle();
    const err = e as { response?: { data?: { code?: string; error?: string } } };
    notice(err?.response?.data?.code === 'livekit_disabled'
      ? 'Голосовые каналы недоступны: сервер звонков не настроен'
      : err?.response?.data?.error || 'Не удалось подключиться к каналу');
    return;
  }
  if (seq !== joinSeq) return;
  if (!creds) {
    resetIdle();
    notice('Не удалось подключиться к каналу');
    return;
  }

  const ok = await lk.connectRoom(creds, { video: false }, {
    onRemoteVideo: () => {},
    onDisconnected: () => {
      if (seq === joinSeq && state.status !== 'idle') {
        void teardown(true);
        notice('Соединение с голосовым каналом потеряно');
      }
    },
    onMicError: (m) => notice(m),
    onSpeakers: (ids, local) => {
      if (seq === joinSeq) setState({ speaking: ids, localSpeaking: local && !state.selfMute && !state.serverMute });
    },
  });

  if (seq !== joinSeq) return;
  if (!ok) {
    resetIdle();
    notice('Не удалось подключиться к серверу звонков');
    return;
  }

  setState({ status: 'connected', startedAt: Date.now() });
  await lk.setMicEnabled(!state.selfMute && !state.serverMute);
  lk.setDeafened(state.selfDeaf);
  sendJoin();
}

function sendJoin() {
  if (!state.channelId) return;
  sendWS({ type: 'voice.join', channel_id: state.channelId, self_mute: state.selfMute, self_deaf: state.selfDeaf });
  sendUpdate();
}

function sendUpdate() {
  sendWS({ type: 'voice.update', self_mute: state.selfMute, self_deaf: state.selfDeaf, video: false, stream: false });
}

function resetIdle() {
  setState({
    status: 'idle', channelId: null, communityId: null, channelName: '', communityName: '',
    serverMute: false, speaking: [], localSpeaking: false, startedAt: null,
  });
}

async function teardown(lost: boolean) {
  const communityId = state.communityId;
  if (!lost) sendWS({ type: 'voice.leave' });
  lk.setDeafened(false);
  const p = lk.disconnectRoom();
  resetIdle();
  if (communityId && !watched.has(communityId)) sendWS({ type: 'voice.unsubscribe', community_id: communityId });
  await p;
}

/** Выйти из канала. */
export async function leaveVoiceChannel(): Promise<void> {
  if (state.status === 'idle') return;
  joinSeq++;
  await teardown(false);
}

// звонок забирает LiveKit — выходим из канала до подключения звонка
registerVoiceLeave(() => {
  if (state.status !== 'idle') {
    joinSeq++;
    void teardown(false);
    notice('Голосовой канал отключён: начался звонок');
  }
});

// ---------------- Управление собой ----------------

export function toggleVoiceMute() {
  if (state.status === 'idle') {
    setState({ selfMute: !state.selfMute });
    return;
  }
  if (state.serverMute) {
    notice('Микрофон выключен модератором');
    return;
  }
  const selfMute = !state.selfMute;
  // как в Discord: включая микрофон, снимаем и «не слышать»
  const selfDeaf = selfMute ? state.selfDeaf : false;
  setState({ selfMute, selfDeaf });
  lk.setDeafened(selfDeaf);
  void lk.setMicEnabled(!selfMute);
  sendUpdate();
}

export function toggleVoiceDeaf() {
  const selfDeaf = !state.selfDeaf;
  // deafen глушит и микрофон; снятие deafen возвращает микрофон
  const selfMute = selfDeaf;
  setState({ selfDeaf, selfMute });
  if (state.status === 'idle') return;
  lk.setDeafened(selfDeaf);
  void lk.setMicEnabled(!selfMute && !state.serverMute);
  sendUpdate();
}

/** Модерация (владелец сообщества): серверный мьют, отключение. */
export function moderateVoice(targetUserId: number, action: 'mute' | 'unmute' | 'disconnect') {
  sendWS({ type: 'voice.moderate', target_user_id: targetUserId, action });
}

// ---------------- Каналы: создание и удаление (владелец) ----------------

export async function createVoiceChannel(communityId: number, name: string, userLimit = 0) {
  await api.post(`/communities/${communityId}/channels`, { name, user_limit: userLimit });
  await refreshChannels(communityId);
}

export async function deleteVoiceChannel(channel: VoiceChannelInfo) {
  await api.delete(`/community-channels/${channel.id}`);
  await refreshChannels(channel.community_id);
}

// ---------------- WS ----------------

let initialized = false;

/** Подключить обработку voice.* (один раз). */
export function initVoiceChannels(meId: number) {
  myId = meId;
  if (state.selfId !== meId) setState({ selfId: meId });
  if (initialized) return;
  initialized = true;
  onChatEvent((d) => {
    const ev = d as Record<string, any>;
    switch (ev.type) {
      case '__open':
        // переподключение WS: сервер забыл подписки и присутствие — восстанавливаем
        watched.forEach((_, id) => sendWS({ type: 'voice.subscribe', community_id: id }));
        if (state.communityId && !watched.has(state.communityId)) sendWS({ type: 'voice.subscribe', community_id: state.communityId });
        if (state.status === 'connected') sendJoin();
        break;
      case 'voice.invited':
        if (state.channelId !== ev.channel?.id) setState({ invite: { ...(ev as VoiceInvite), at: Date.now() } });
        break;
      case 'voice.snapshot':
        patchCommunity(ev.community_id, (c) => ({ ...c, members: ev.states || [] }));
        break;
      case 'voice.state':
        upsertMember(ev.community_id, ev.user_id, ev.state || null);
        break;
      case 'voice.channels':
        void refreshChannels(ev.community_id);
        break;
      case 'voice.joined':
        if (ev.channel_id === state.channelId && ev.server_mute && !state.serverMute) {
          setState({ serverMute: true });
          void lk.setMicEnabled(false);
        }
        break;
      case 'voice.error':
        if (state.status !== 'idle' && (!ev.channel_id || ev.channel_id === state.channelId)) {
          joinSeq++;
          void teardown(false);
        }
        notice(ev.error || 'Ошибка голосового канала');
        break;
      case 'voice.kicked':
        if (state.channelId === ev.channel_id) {
          joinSeq++;
          void teardown(true);
          notice(ev.reason === 'deleted' ? 'Канал удалён' : `Вас отключил ${ev.by?.display_name || ev.by?.username || 'модератор'}`);
        }
        break;
      case 'voice.moved': {
        const ch = state.communities[ev.community_id]?.channels.find((c) => c.id === ev.channel_id);
        if (ch) {
          const name = state.communityName;
          joinSeq++;
          void teardown(true).then(() => joinVoiceChannel(ch, name)).then(() => notice(`Вас перенесли в «${ch.name}»`));
        }
        break;
      }
    }
  });
}

// ---------------- Чат канала и приглашения ----------------

export async function getVoiceChatHistory(channelId: number): Promise<VoiceChatMessage[]> {
  const res = await api.get(`/community-channels/${channelId}/messages`);
  return Array.isArray(res.data) ? (res.data as VoiceChatMessage[]) : [];
}

export function sendVoiceChat(channelId: number, content: string): boolean {
  return sendWS({ type: 'voice.chat', channel_id: channelId, content });
}

export async function deleteVoiceChatMessage(id: number): Promise<void> {
  await api.delete(`/community-channel-messages/${id}`);
}

export function inviteToVoiceChannel(channelId: number, userId: number): boolean {
  return sendWS({ type: 'voice.invite', channel_id: channelId, target_user_id: userId });
}

export function declineVoiceInvite() {
  setState({ invite: null });
}

export async function acceptVoiceInvite(): Promise<void> {
  const invite = state.invite;
  if (!invite) return;
  setState({ invite: null });
  if (invite.invite_code) {
    // уже участник — сервер ответит ошибкой, это не мешает зайти в канал
    await joinByInvite(invite.invite_code).catch(() => {});
    await refreshChannels(invite.community_id);
  }
  await joinVoiceChannel(invite.channel, invite.community_name);
}

/** Участники канала (по присутствию), в порядке входа. */
export function membersOf(communityId: number, channelId: number): VoiceMember[] {
  return (state.communities[communityId]?.members ?? [])
    .filter((m) => m.channel_id === channelId)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
}
