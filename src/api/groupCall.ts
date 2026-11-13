import { connectChat, onChatEvent, sendWS } from './chat';
import * as lk from './livekitRoom';
import { leaveVoiceForCall } from './voiceBridge';

export interface GroupCallParticipant {
  id: number;
  username: string;
  avatar_url?: string;
}

export type GroupCallStatus = 'idle' | 'incoming' | 'active';

export interface GroupCallState {
  status: GroupCallStatus;
  callId: string | null;
  groupId: number | null;
  groupName: string | null;
  caller: GroupCallParticipant | null;
  participants: GroupCallParticipant[];
  micMuted: boolean;
  videoEnabled: boolean;
  /** Участники, которые шлют видео. */
  videoUsers: number[];
  startedAt: number | null;
  notice: string | null;
}

let state: GroupCallState = {
  status: 'idle', callId: null, groupId: null, groupName: null,
  caller: null, participants: [], micMuted: false, videoEnabled: false, videoUsers: [],
  startedAt: null, notice: null,
};
const listeners = new Set<(s: GroupCallState) => void>();
function setState(patch: Partial<GroupCallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}
export function getGroupCallState() { return state; }
export function subscribeGroupCall(l: (s: GroupCallState) => void): () => void {
  listeners.add(l); l(state); return () => listeners.delete(l);
}

let initialized = false;

type Sig = {
  type?: string;
  call_id?: string;
  group_id?: number;
  caller?: GroupCallParticipant;
  participants?: GroupCallParticipant[];
  user?: GroupCallParticipant;
  user_id?: number;
  from?: GroupCallParticipant;
  target_user_id?: number;
  reason?: string;
  active?: boolean;
};

function applyRemoteVideo(userId: number, kind: 'cam' | 'screen', stream: unknown) {
  if (kind !== 'cam') return;
  if (stream) {
    if (!state.videoUsers.includes(userId)) setState({ videoUsers: [...state.videoUsers, userId] });
  } else if (state.videoUsers.includes(userId)) {
    setState({ videoUsers: state.videoUsers.filter((x) => x !== userId) });
  }
}

/** Поднимает LiveKit-комнату группы. */
async function connectLiveKitGroup(groupId: number): Promise<boolean> {
  leaveVoiceForCall(); // комната LiveKit одна — голосовой канал уступает звонку
  const creds = await lk.fetchLiveKitToken({ groupId });
  if (!creds) {
    setState({ notice: 'Не удалось получить доступ к звонку (LiveKit)' });
    return false;
  }
  // Пока ждали, звонок мог закончиться
  if (state.status !== 'active') return false;
  const ok = await lk.connectRoom(
    creds,
    { video: false },
    {
      onRemoteVideo: applyRemoteVideo,
      onDisconnected: () => {
        if (state.status === 'active') resetGroupCall();
      },
      onMicError: (message) => setState({ notice: message }),
    },
  );
  if (!ok) {
    setState({ notice: 'Не удалось подключиться к звонку' });
    return false;
  }
  if (state.status !== 'active') {
    void lk.disconnectRoom();
    return false;
  }
  setState({ status: 'active', startedAt: state.startedAt || Date.now() });
  return true;
}

function resetGroupCall() {
  void lk.disconnectRoom();
  setState({
    status: 'idle', callId: null, groupId: null, groupName: null, caller: null,
    participants: [], micMuted: false, videoEnabled: false, videoUsers: [], startedAt: null,
  });
}

function addParticipant(p: GroupCallParticipant) {
  if (!p?.id) return;
  if (state.participants.some((x) => x.id === p.id)) return;
  setState({ participants: [...state.participants, p] });
}

function removeParticipant(userId: number) {
  setState({
    participants: state.participants.filter((x) => x.id !== userId),
    videoUsers: state.videoUsers.filter((x) => x !== userId),
  });
}

// --- Публичное API ---

export function startGroupCall(groupId: number, groupName: string, me: GroupCallParticipant) {
  if (state.status !== 'idle' || !groupId) return;
  connectChat();
  sendWS({ type: 'group.call.start', group_id: groupId });
  setState({ status: 'active', groupId, groupName, participants: [me], startedAt: Date.now(), notice: null });
  void connectLiveKitGroup(groupId);
}

/** Подключиться к уже идущему звонку группы (плашка в чате), даже если нам не звонили. */
export function joinGroupCall(callId: string, groupId: number, groupName: string, me: GroupCallParticipant) {
  if (!callId || !groupId) return;
  if (state.status === 'active') {
    if (state.callId !== callId) setState({ notice: 'Сначала выйдите из текущего звонка' });
    return;
  }
  if (state.status === 'incoming' && state.callId !== callId) declineGroupCall();
  connectChat();
  setState({ status: 'active', callId, groupId, groupName, caller: null, participants: [me], startedAt: Date.now(), notice: null });
  sendWS({ type: 'group.call.accept', call_id: callId }, { queue: true });
  void connectLiveKitGroup(groupId);
}

export function acceptGroupCall() {
  if (state.status !== 'incoming' || !state.callId) return;
  sendWS({ type: 'group.call.accept', call_id: state.callId });
  setState({ status: 'active', startedAt: Date.now() });
  if (state.groupId) void connectLiveKitGroup(state.groupId);
}

export function declineGroupCall() {
  if (state.callId) sendWS({ type: 'group.call.leave', call_id: state.callId });
  resetGroupCall();
}

export function leaveGroupCall() {
  if (state.callId) sendWS({ type: 'group.call.leave', call_id: state.callId });
  resetGroupCall();
}

export function endGroupCall() {
  if (state.callId) sendWS({ type: 'group.call.end', call_id: state.callId });
  resetGroupCall();
}

export function toggleGroupMute() {
  const muted = !state.micMuted;
  setState({ micMuted: muted });
  void lk.setMicEnabled(!muted);
}

export async function toggleGroupVideo() {
  if (state.status !== 'active') return;
  const next = !state.videoEnabled;
  const ok = await lk.setCameraEnabled(next);
  if (!ok && next) {
    setState({ notice: 'Нет доступа к камере' });
    return;
  }
  setState({ videoEnabled: next });
}

/** Переключить фронтальную/заднюю камеру. */
export function switchGroupCamera() {
  lk.switchCamera();
}

export function getLocalGroupVideoStream() {
  return lk.getLocalCamera();
}

export function getGroupParticipantStream(userId: number) {
  return lk.getRemoteCameraFor(userId);
}

export function clearGroupCallNotice() { setState({ notice: null }); }

export function initGroupCallManager(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const off = onChatEvent((raw) => {
    const data = raw as Sig;
    switch (data.type) {
      case 'group.call.started':
        setState({ status: 'active', callId: data.call_id ?? null, groupId: data.group_id ?? null, participants: data.participants || state.participants, startedAt: Date.now() });
        break;
      case 'group.call.incoming': {
        if (state.status !== 'idle') {
          sendWS({ type: 'group.call.leave', call_id: data.call_id });
          return;
        }
        setState({ status: 'incoming', callId: data.call_id ?? null, groupId: data.group_id ?? null, caller: data.caller ?? null, notice: null });
        break;
      }
      case 'group.call.accepted': {
        if (state.callId !== data.call_id) return;
        setState({ status: 'active', startedAt: state.startedAt || Date.now() });
        (data.participants || []).forEach((p) => addParticipant(p));
        break;
      }
      case 'group.call.joined':
        if (state.callId !== data.call_id) return;
        if (data.user) addParticipant(data.user);
        break;
      // P2P-mesh старого клиента — игнорируем, медиа через SFU.
      case 'group.call.offer':
      case 'group.call.answer':
      case 'group.call.ice':
        break;
      case 'group.call.left': {
        if (state.callId !== data.call_id) return;
        const uid = data.user_id;
        if (uid != null) removeParticipant(uid);
        break;
      }
      case 'group.call.ended':
        if (state.callId !== data.call_id) return;
        resetGroupCall();
        // Нажали «Подключиться», а звонок уже закончился
        if (data.reason === 'gone') setState({ notice: 'Звонок уже завершился' });
        break;
      case 'group.call.state':
        // group.call.ended приходит только сидящим в звонке: у остальных он ещё звонит.
        // Пока сервер не выдал callId, это мы только начинаем новый звонок — не трогаем.
        if (data.active || data.group_id !== state.groupId || !state.callId) return;
        resetGroupCall();
        break;
      case 'group.call.busy':
        setState({ notice: 'В этой группе уже идёт звонок' });
        resetGroupCall();
        break;
    }
  });

  return () => { off(); initialized = false; resetGroupCall(); };
}
