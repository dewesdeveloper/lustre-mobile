import api from './client';
import { getPreset } from './mediaQuality';

// LiveKit-модули подгружаем лениво: в Expo Go нативных WebRTC-модулей нет,
// и статический import уронил бы всё приложение. Звонки, как и раньше,
// требуют dev/release-сборки.
type LK = typeof import('livekit-client');
type RN = typeof import('@livekit/react-native');
type RNW = typeof import('@livekit/react-native-webrtc');
type RNMediaStream = import('@livekit/react-native-webrtc').MediaStream;

interface Mods { lk: LK; rn: RN; rnw: RNW; }
let mods: Mods | null = null;

async function loadLiveKit(): Promise<Mods | null> {
  if (mods) return mods;
  try {
    const [rn, rnw] = await Promise.all([
      import('@livekit/react-native'),
      import('@livekit/react-native-webrtc'),
    ]);
    // Регистрирует WebRTC-глобалы (должно быть ДО импорта/создания Room).
    rn.registerGlobals();
    const lk = await import('livekit-client');
    mods = { lk, rn, rnw };
    return mods;
  } catch {
    return null;
  }
}

export interface LiveKitCreds {
  token: string;
  url: string;
  room: string;
}

export type LiveKitTarget = { conversationId?: number; groupId?: number; userId?: number; channelId?: number };

export interface LiveKitHandlers {
  /** Пришёл/ушёл видео-трек участника. userId = identity (user_id). */
  onRemoteVideo: (userId: number, kind: 'cam' | 'screen', stream: RNMediaStream | null) => void;
  /** Изменился локальный видео-трек (для превью). */
  onLocalVideo?: (kind: 'cam' | 'screen', stream: RNMediaStream | null) => void;
  onDisconnected: () => void;
  onMicError?: (message: string) => void;
  /** Кто сейчас говорит: user_id участников (и local — говорит ли сам пользователь) */
  onSpeakers?: (userIds: number[], local: boolean) => void;
}

let room: import('livekit-client').Room | null = null;
let localCam: RNMediaStream | null = null;
let localScreen: RNMediaStream | null = null;
let remoteCam: RNMediaStream | null = null;
let remoteScreen: RNMediaStream | null = null;
const remoteCamByUser = new Map<number, RNMediaStream>();
const remoteScreenByUser = new Map<number, RNMediaStream>();

// ---- Громкость звука демонстрации экрана отдельно для каждого участника (как в лаунчере) ----
type VolumeTrack = { setVolume?: (v: number) => void };
const screenAudioByUser = new Map<number, VolumeTrack>();
/** 0..1; запоминается на время работы приложения, переживает переподключения */
const screenVolumes = new Map<number, number>();
const screenAudioListeners = new Set<() => void>();
const emitScreenAudio = () => screenAudioListeners.forEach((l) => l());

/** Голоса участников (микрофоны) — нужны для режима «не слышать» */
const voiceAudio = new Set<VolumeTrack>();
let deafened = false;

function setTrackVolume(t: VolumeTrack | undefined, v: number) {
  try {
    t?.setVolume?.(v);
  } catch {
    /* дорожка уже закрыта */
  }
}

function applyScreenVolume(uid: number) {
  setTrackVolume(screenAudioByUser.get(uid), deafened ? 0 : (screenVolumes.get(uid) ?? 1));
}

/** «Не слышать» (deafen, как в Discord): глушит всех участников, включая звук демонстраций */
export function setDeafened(on: boolean) {
  deafened = on;
  voiceAudio.forEach((t) => setTrackVolume(t, on ? 0 : 1));
  screenAudioByUser.forEach((_, uid) => applyScreenVolume(uid));
}

/** Есть ли у участника звук демонстрации экрана */
export function hasScreenAudio(userId: number): boolean {
  return screenAudioByUser.has(userId);
}

export function getScreenVolume(userId: number): number {
  return screenVolumes.get(userId) ?? 1;
}

/** Громкость звука демонстрации экрана участника, 0..1 (голос участника не меняется) */
export function setScreenVolume(userId: number, volume: number) {
  screenVolumes.set(userId, Math.max(0, Math.min(1, volume)));
  applyScreenVolume(userId);
  emitScreenAudio();
}

export function subscribeScreenAudio(cb: () => void): () => void {
  screenAudioListeners.add(cb);
  return () => screenAudioListeners.delete(cb);
}

/** Запрашивает короткоживущий LiveKit-токен у бэкенда. */
export async function fetchLiveKitToken(target: LiveKitTarget): Promise<LiveKitCreds | null> {
  try {
    const body: Record<string, number> = {};
    if (target.conversationId) body.conversation_id = target.conversationId;
    if (target.groupId) body.group_id = target.groupId;
    if (target.userId) body.user_id = target.userId;
    if (target.channelId) body.channel_id = target.channelId;
    const res = await api.post('/calls/token', body);
    const data = res.data as LiveKitCreds;
    if (!data?.token || !data?.url) return null;
    return data;
  } catch {
    return null;
  }
}

function toStream(m: Mods, track: { mediaStreamTrack: unknown }): RNMediaStream {
  return new m.rnw.MediaStream([track.mediaStreamTrack as never]);
}

function userIdOf(p: unknown): number {
  const n = Number((p as { identity?: string })?.identity);
  return Number.isFinite(n) ? n : 0;
}

function refreshLocalVideo(handlers?: LiveKitHandlers) {
  if (!room || !mods) return;
  const cam = room.localParticipant.getTrackPublication(mods.lk.Track.Source.Camera)?.track;
  const scr = room.localParticipant.getTrackPublication(mods.lk.Track.Source.ScreenShare)?.track;
  if (cam) localCam = toStream(mods, cam);
  else localCam = null;
  if (scr) localScreen = toStream(mods, scr);
  else localScreen = null;
  handlers?.onLocalVideo?.('cam', localCam);
  handlers?.onLocalVideo?.('screen', localScreen);
}

/** Подключается к комнате LiveKit и публикует микрофон (и камеру, если нужно). */
export async function connectRoom(
  creds: LiveKitCreds,
  opts: { video: boolean },
  handlers: LiveKitHandlers,
): Promise<boolean> {
  const m = await loadLiveKit();
  if (!m) return false;
  const { lk, rn } = m;

  try {
    await rn.AudioSession.startAudioSession();
  } catch {
    // не критично — WebRTC-аудио всё равно попробует подняться
  }

  const preset = getPreset();
  try {
    room = new lk.Room({
      // Полное разрешение вместо низкого слоя для маленьких плиток.
      adaptiveStream: false,
      dynacast: true,
      videoCaptureDefaults: { resolution: preset.resolution, frameRate: preset.frameRate },
      publishDefaults: {
        videoEncoding: { maxBitrate: preset.cameraBitrate, maxFramerate: preset.frameRate },
        screenShareEncoding: { maxBitrate: preset.screenBitrate, maxFramerate: preset.frameRate },
      },
    });
  } catch {
    return false;
  }

  room
    .on(lk.RoomEvent.TrackSubscribed, (track, pub, participant) => {
      // Аудио в RN воспроизводится нативно, attach не нужен. Звук демонстрации экрана
      // запоминаем отдельно — у него своя громкость.
      if (track.kind === lk.Track.Kind.Audio) {
        const auid = userIdOf(participant);
        if (auid && pub.source === lk.Track.Source.ScreenShareAudio) {
          screenAudioByUser.set(auid, track as unknown as VolumeTrack);
          applyScreenVolume(auid);
          emitScreenAudio();
        } else {
          voiceAudio.add(track as unknown as VolumeTrack);
          if (deafened) setTrackVolume(track as unknown as VolumeTrack, 0);
        }
        return;
      }
      const uid = userIdOf(participant);
      if (!uid) return;
      const stream = toStream(m, track);
      if (pub.source === lk.Track.Source.ScreenShare) {
        remoteScreenByUser.set(uid, stream);
        remoteScreen = stream;
        handlers.onRemoteVideo(uid, 'screen', stream);
      } else {
        remoteCamByUser.set(uid, stream);
        remoteCam = stream;
        handlers.onRemoteVideo(uid, 'cam', stream);
      }
    })
    .on(lk.RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      if (track.kind === lk.Track.Kind.Audio) {
        const auid = userIdOf(participant);
        if (auid && pub.source === lk.Track.Source.ScreenShareAudio && screenAudioByUser.delete(auid)) emitScreenAudio();
        voiceAudio.delete(track as unknown as VolumeTrack);
        return;
      }
      const uid = userIdOf(participant);
      if (!uid) return;
      if (pub.source === lk.Track.Source.ScreenShare) {
        remoteScreenByUser.delete(uid);
        remoteScreen = null;
        handlers.onRemoteVideo(uid, 'screen', null);
      } else {
        remoteCamByUser.delete(uid);
        remoteCam = null;
        handlers.onRemoteVideo(uid, 'cam', null);
      }
    })
    .on(lk.RoomEvent.LocalTrackPublished, () => refreshLocalVideo(handlers))
    .on(lk.RoomEvent.LocalTrackUnpublished, () => refreshLocalVideo(handlers))
    .on(lk.RoomEvent.ParticipantDisconnected, (p: unknown) => {
      const uid = userIdOf(p);
      if (!uid) return;
      if (remoteCamByUser.delete(uid)) handlers.onRemoteVideo(uid, 'cam', null);
      if (remoteScreenByUser.delete(uid)) handlers.onRemoteVideo(uid, 'screen', null);
      if (screenAudioByUser.delete(uid)) emitScreenAudio();
    })
    .on(lk.RoomEvent.ActiveSpeakersChanged, (speakers: unknown[]) => {
      if (!handlers.onSpeakers || !room) return;
      const localId = room.localParticipant.identity;
      let local = false;
      const ids: number[] = [];
      for (const p of speakers) {
        if ((p as { identity?: string }).identity === localId) local = true;
        else {
          const id = userIdOf(p);
          if (id) ids.push(id);
        }
      }
      handlers.onSpeakers(ids, local);
    })
    .on(lk.RoomEvent.Disconnected, () => handlers.onDisconnected());

  try {
    await room.connect(creds.url, creds.token);
  } catch {
    try { await room.disconnect(); } catch { /* ignore */ }
    room = null;
    try { await rn.AudioSession.stopAudioSession(); } catch { /* ignore */ }
    return false;
  }

  try {
    await room.localParticipant.setMicrophoneEnabled(true);
  } catch {
    handlers.onMicError?.('Нет доступа к микрофону — разреши его в настройках приложения');
  }

  if (opts.video) {
    try { await setCameraEnabled(true); } catch { /* ignore */ }
  }

  refreshLocalVideo(handlers);
  return true;
}

export async function disconnectRoom() {
  const r = room;
  room = null;
  localCam = null;
  localScreen = null;
  remoteCam = null;
  remoteScreen = null;
  remoteCamByUser.clear();
  remoteScreenByUser.clear();
  voiceAudio.clear();
  deafened = false;
  if (screenAudioByUser.size) {
    screenAudioByUser.clear();
    emitScreenAudio();
  }
  if (r) {
    try { await r.disconnect(); } catch { /* ignore */ }
  }
  const m = mods;
  if (m) {
    try { await m.rn.AudioSession.stopAudioSession(); } catch { /* ignore */ }
  }
}

export function hasRoom(): boolean {
  return room !== null;
}

export async function setMicEnabled(on: boolean) {
  if (!room) return;
  try { await room.localParticipant.setMicrophoneEnabled(on); } catch { /* ignore */ }
}

export async function setCameraEnabled(on: boolean): Promise<boolean> {
  if (!room) return false;
  const preset = getPreset();
  try {
    await room.localParticipant.setCameraEnabled(
      on,
      { resolution: preset.resolution, frameRate: preset.frameRate },
      { videoEncoding: { maxBitrate: preset.cameraBitrate, maxFramerate: preset.frameRate } },
    );
    refreshLocalVideo();
    return true;
  } catch {
    return false;
  }
}

export async function setScreenShareEnabled(on: boolean): Promise<boolean> {
  if (!room) return false;
  const preset = getPreset();
  try {
    await room.localParticipant.setScreenShareEnabled(
      on,
      { resolution: preset.resolution },
      {
        simulcast: false,
        screenShareEncoding: { maxBitrate: preset.screenBitrate, maxFramerate: preset.frameRate },
        degradationPreference: 'maintain-resolution',
      },
    );
    refreshLocalVideo();
    return true;
  } catch {
    return false;
  }
}

export function getLocalCamera(): RNMediaStream | null {
  return localCam;
}

/** Переключение фронтальная/задняя камера (react-native-webrtc). */
export function switchCamera(): boolean {
  if (!room || !mods) return false;
  const track = room.localParticipant.getTrackPublication(mods.lk.Track.Source.Camera)?.track
    ?.mediaStreamTrack as unknown as { _switchCamera?: () => void };
  if (track && typeof track._switchCamera === 'function') {
    track._switchCamera();
    return true;
  }
  return false;
}

export function getLocalScreen(): RNMediaStream | null {
  return localScreen;
}

export function getRemoteCamera(): RNMediaStream | null {
  return remoteCam;
}

export function getRemoteScreen(): RNMediaStream | null {
  return remoteScreen;
}

export function getRemoteCameraFor(userId: number): RNMediaStream | null {
  return remoteCamByUser.get(userId) ?? null;
}

export function getRemoteScreenFor(userId: number): RNMediaStream | null {
  return remoteScreenByUser.get(userId) ?? null;
}

export function listRemoteVideoUsers(): number[] {
  return Array.from(remoteCamByUser.keys());
}
