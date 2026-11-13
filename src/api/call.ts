import { connectChat, onChatEvent, onChatState, sendWS } from './chat';
import * as lk from './livekitRoom';
import { leaveVoiceForCall } from './voiceBridge';

export interface CallPeer {
  id: number;
  username: string;
  avatar_url?: string;
}

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'active';

export interface CallState {
  status: CallStatus;
  callId: string | null;
  peer: CallPeer | null;
  micMuted: boolean;
  /** Наша камера включена. */
  videoEnabled: boolean;
  /** Мы демонстрируем экран. */
  sharingScreen: boolean;
  /** У собеседника есть видеотрек. */
  remoteVideo: boolean;
  /** Это демонстрация экрана собеседника (а не камера). */
  remoteScreen: boolean;
  /** Фронтальная камера активна (иначе задняя). */
  frontCamera: boolean;
  startedAt: number | null;
  notice: string | null;
  /** Нет связи с сервером — звонок ждёт переподключения (сервер держит его 30 с). */
  serverLost: boolean;
  /** Собеседник потерял связь с сервером и переподключается. */
  peerReconnecting: boolean;
}

let state: CallState = {
  status: 'idle', callId: null, peer: null, micMuted: false,
  videoEnabled: false, sharingScreen: false, remoteVideo: false, remoteScreen: false,
  frontCamera: true, startedAt: null, notice: null, serverLost: false, peerReconnecting: false,
};
const listeners = new Set<(s: CallState) => void>();

function setState(patch: Partial<CallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getCallState(): CallState {
  return state;
}

export function subscribeCall(listener: (s: CallState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

let initialized = false;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingEnableVideo = false;
let connecting = false;

function applyRemoteVideo(_userId: number, kind: 'cam' | 'screen', stream: unknown) {
  if (kind === 'screen') setState({ remoteScreen: !!stream });
  else setState({ remoteVideo: !!stream });
}

/** Поднимает LiveKit-комнату личного звонка (комната выводится из пары user_id). */
async function connectLiveKit(withVideo: boolean): Promise<boolean> {
  if (connecting) return false;
  if (!state.peer?.id) return false;
  connecting = true;
  try {
    const creds = await lk.fetchLiveKitToken({ userId: state.peer.id });
    if (!creds) {
      setState({ notice: 'Не удалось получить доступ к звонку (LiveKit)' });
      return false;
    }
    const ok = await lk.connectRoom(
      creds,
      { video: withVideo },
      {
        onRemoteVideo: applyRemoteVideo,
        onDisconnected: () => {
          if (state.status !== 'active') return;
          // сообщаем серверу, иначе собеседник остаётся «в звонке»
          if (state.callId) sendWS({ type: 'call.end', call_id: state.callId }, { queue: true });
          resetCall({ notice: 'Соединение потеряно' });
        },
        onMicError: (message) => setState({ notice: message }),
      },
    );
    if (!ok) {
      setState({ notice: 'Не удалось подключиться к звонку' });
      return false;
    }
    setState({ status: 'active', startedAt: state.startedAt || Date.now() });
    return true;
  } finally {
    connecting = false;
  }
}

function resetCall(patch: Partial<CallState> = {}) {
  if (ringTimeout) {
    clearTimeout(ringTimeout);
    ringTimeout = null;
  }
  pendingEnableVideo = false;
  connecting = false;
  void lk.disconnectRoom();
  setState({
    status: 'idle', callId: null, peer: null, micMuted: false, videoEnabled: false,
    sharingScreen: false, remoteVideo: false, remoteScreen: false, frontCamera: true,
    startedAt: null, serverLost: false, peerReconnecting: false, ...patch,
  });
}

type Sig = {
  type?: string;
  call_id?: string;
  peer?: CallPeer;
  caller?: CallPeer;
  video?: boolean;
  target_user_id?: number;
  reason?: string;
  accepted?: boolean;
  peer_online?: boolean;
};

// --- Управление звонком ---

export function startCall(peer: CallPeer, withVideo = false) {
  if (state.status !== 'idle' || !peer.id) return;
  connectChat();
  leaveVoiceForCall();
  if (withVideo) pendingEnableVideo = true;
  const sent = sendWS({ type: 'call.invite', target_user_id: peer.id, video: withVideo }, { queue: true });
  setState({ status: 'outgoing', peer, notice: null, videoEnabled: false, remoteVideo: false, serverLost: !sent });
  ringTimeout = setTimeout(() => {
    if (state.status !== 'outgoing') return;
    const reached = !!state.callId;
    if (reached) sendWS({ type: 'call.decline', call_id: state.callId });
    // сервер так и не подтвердил вызов — звонок не ушёл
    resetCall(reached ? {} : { notice: 'Не удалось позвонить: нет связи с сервером' });
  }, 45000);
}

export function acceptCall() {
  if (state.status !== 'incoming' || !state.callId) return;
  sendWS({ type: 'call.accept', call_id: state.callId }, { queue: true });
  leaveVoiceForCall();
  setState({ status: 'active', startedAt: Date.now() });
  void connectLiveKit(pendingEnableVideo);
}

// Принять звонок по call_id (например, из полноэкранного уведомления,
// когда приложение проснулось от push и не получило call.ring).
export function acceptCallById(callId: string, peer: CallPeer) {
  if (!callId || !peer?.id) return;
  if (state.status === 'active' && state.callId === callId) return;
  connectChat();
  leaveVoiceForCall();
  setState({
    status: 'active', callId, peer, startedAt: Date.now(), notice: null,
    videoEnabled: false, remoteVideo: false,
  });
  sendWS({ type: 'call.accept', call_id: callId });
  void connectLiveKit(pendingEnableVideo);
}

// Отклонить звонок по call_id (из уведомления).
export function declineCallById(callId: string) {
  if (!callId) return;
  sendWS({ type: 'call.decline', call_id: callId });
  if (state.callId === callId) resetCall();
}

export function declineCall() {
  if (state.callId) sendWS({ type: 'call.decline', call_id: state.callId }, { queue: true });
  resetCall();
}

export function endCall() {
  if (state.callId) sendWS({ type: 'call.end', call_id: state.callId }, { queue: true });
  resetCall();
}

export function toggleMute() {
  const muted = !state.micMuted;
  setState({ micMuted: muted });
  void lk.setMicEnabled(!muted);
}

export function clearCallNotice() {
  setState({ notice: null });
}

// --- Видео ---

export async function toggleVideo() {
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
export function switchCamera() {
  if (lk.switchCamera()) setState({ frontCamera: !state.frontCamera });
}

/** Локальный видеопоток для RTCView. */
export function getLocalVideoStream() {
  return lk.getLocalCamera();
}

/** Удалённый видеопоток собеседника для RTCView. */
export function getRemoteVideoStream() {
  return lk.getRemoteCamera();
}

// --- Демонстрация экрана (Android: MediaProjection; iOS: ReplayKit) ---

export async function startScreenShare() {
  if (state.status !== 'active' || state.sharingScreen) return;
  const ok = await lk.setScreenShareEnabled(true);
  if (ok) setState({ sharingScreen: true });
  else setState({ notice: 'Не удалось начать демонстрацию экрана' });
}

export async function stopScreenShare() {
  if (!state.sharingScreen) return;
  await lk.setScreenShareEnabled(false);
  setState({ sharingScreen: false });
}

export function toggleScreenShare(): Promise<void> {
  return state.sharingScreen ? stopScreenShare() : startScreenShare();
}

/** Локальный поток демонстрации экрана. */
export function getLocalScreenStream() {
  return lk.getLocalScreen();
}

/** Удалённый поток демонстрации экрана собеседника. */
export function getRemoteScreenStream() {
  return lk.getRemoteScreen();
}

/** Доступен ли WebRTC (dev-build/release, но не Expo Go). */
export async function isRtcAvailable(): Promise<boolean> {
  try {
    await import('@livekit/react-native-webrtc');
    return true;
  } catch {
    return false;
  }
}

export function initCallManager(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const off = onChatEvent((raw) => {
    const data = raw as Sig;
    switch (data.type) {
      case 'call.outgoing': {
        setState({ status: 'outgoing', callId: data.call_id ?? null, peer: data.peer ?? null, notice: null });
        break;
      }
      case 'call.ring': {
        if (state.callId === data.call_id) return; // повтор того же вызова
        if (state.status !== 'idle') {
          // Сервер пропускает вызов, только если у нас нет другого звонка: «занятое»
          // состояние — хвост оборвавшегося звонка. Раньше вызов из-за него сразу
          // отклонялся, и звонящий видел «отклонил вызов», хотя у нас не зазвонило.
          if (state.status === 'outgoing' && !state.callId) {
            sendWS({ type: 'call.decline', call_id: data.call_id, reason: 'busy' });
            return;
          }
          resetCall();
        }
        if (data.video) pendingEnableVideo = true;
        setState({ status: 'incoming', callId: data.call_id ?? null, peer: data.caller ?? null, notice: null, videoEnabled: false, remoteVideo: false });
        ringTimeout = setTimeout(() => {
          if (state.status === 'incoming') resetCall();
        }, 60000);
        break;
      }
      case 'call.synced': {
        if (state.callId !== data.call_id) return;
        setState({ serverLost: false, peerReconnecting: !data.peer_online });
        // собеседник принял вызов, пока у нас не было связи — call.accepted потерялся
        if (data.accepted && state.status === 'outgoing') {
          setState({ status: 'active', startedAt: Date.now() });
          void connectLiveKit(pendingEnableVideo);
        }
        break;
      }
      case 'call.peer_reconnecting': {
        if (state.callId === data.call_id) setState({ peerReconnecting: true });
        break;
      }
      case 'call.peer_back': {
        if (state.callId === data.call_id) setState({ peerReconnecting: false });
        break;
      }
      case 'call.taken': {
        // принят или отклонён на другом устройстве — здесь перестаём звонить
        if (state.status === 'incoming' && state.callId === data.call_id) resetCall();
        break;
      }
      case 'call.accepted': {
        if (state.status !== 'outgoing' || state.callId !== data.call_id || !data.call_id) return;
        setState({ status: 'active', startedAt: Date.now() });
        void connectLiveKit(pendingEnableVideo);
        break;
      }
      // P2P-сигналинг старого клиента — игнорируем, медиа идёт через SFU.
      case 'call.offer':
      case 'call.answer':
      case 'call.ice':
        break;
      case 'call.declined': {
        if (state.callId !== data.call_id) return;
        resetCall({ notice: `${state.peer?.username || 'Пользователь'} отклонил вызов` });
        break;
      }
      case 'call.forbidden': {
        resetCall({ notice: data.reason || 'Пользователь принимает звонки только от друзей' });
        break;
      }
      case 'call.ended': {
        if (state.callId !== data.call_id) return;
        if (data.reason === 'gone') resetCall({ notice: 'Звонок завершился, пока не было связи с сервером' });
        else if (data.reason === 'disconnect' && state.status === 'active') resetCall({ notice: 'Собеседник потерял соединение — звонок завершён' });
        else resetCall();
        break;
      }
      case 'call.busy': {
        if (state.status === 'outgoing' && (state.peer?.id === data.target_user_id || (!!data.call_id && state.callId === data.call_id))) {
          resetCall({ notice: `${state.peer?.username || 'Пользователь'} сейчас занят` });
        }
        break;
      }
      case 'call.missed': {
        if (state.status === 'idle') return;
        resetCall({ notice: `${state.peer?.username || 'Пользователь'} не в сети` });
        break;
      }
    }
  });

  // обрыв и возврат связи: показываем «нет связи», после переподключения сверяем звонок
  const offState = onChatState((up) => {
    if (state.status === 'idle') return;
    if (!up) { setState({ serverLost: true }); return; }
    setState({ serverLost: false });
    if (state.callId) sendWS({ type: 'call.sync', call_id: state.callId });
  });

  return () => {
    off();
    offState();
    initialized = false;
    resetCall();
  };
}
