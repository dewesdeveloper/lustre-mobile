// Общий стор присутствия (кто онлайн / во что играет) из WS-событий чата.
// Подписка инициализируется один раз при старте приложения — иначе
// разовый presence.snapshot, приходящий при подключении WS, теряется.

import { useEffect, useState } from 'react';

import { onChatEvent } from './chat';

export interface UserPresence {
  online: boolean;
  playing: string | null;
  /** Игра из каталога Lustre, в которую играет пользователь (для обложки) */
  playingId?: number;
  playingCover?: string;
}

const store = new Map<number, UserPresence>();
const listeners = new Set<() => void>();
let initialized = false;

function emit() {
  listeners.forEach((l) => l());
}

export function getPresence(userId: number): UserPresence | undefined {
  return store.get(userId);
}

export function isOnline(userId: number): boolean {
  return store.get(userId)?.online ?? false;
}

export function subscribePresence(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Инициализация подписки на presence (идемпотентно). */
export function initPresence(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const off = onChatEvent((data) => {
    switch (data.type) {
      case 'presence.snapshot': {
        store.clear();
        const playing = (data.playing as Record<string, string>) || {};
        const info = (data.playing_info as Record<string, { game_id?: number; cover?: string }>) || {};
        ((data.user_ids as number[]) || []).forEach((id) => {
          const gi = info[String(id)];
          store.set(id, {
            online: true,
            playing: playing[String(id)] || null,
            playingId: gi?.game_id || undefined,
            playingCover: gi?.cover || undefined,
          });
        });
        emit();
        break;
      }
      case 'presence': {
        const id = data.user_id as number;
        if (data.online) {
          if (!store.has(id)) {
            store.set(id, { online: true, playing: null });
            emit();
          }
        } else if (store.delete(id)) {
          emit();
        }
        break;
      }
      case 'presence.game': {
        const id = data.user_id as number;
        const game = (data.game as string) || null;
        const playingId = (game && Number(data.game_id)) || undefined;
        const playingCover = (game && (data.cover as string)) || undefined;
        const cur = store.get(id);
        if (!cur) {
          if (game) {
            store.set(id, { online: true, playing: game, playingId, playingCover });
            emit();
          }
        } else if ((cur.playing || null) !== game || cur.playingCover !== playingCover) {
          store.set(id, { ...cur, online: true, playing: game, playingId, playingCover });
          emit();
        }
        break;
      }
    }
  });

  return () => {
    off();
    initialized = false;
    store.clear();
  };
}

/** Перерисовка при любом изменении присутствия (для списков). */
export function usePresenceVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => subscribePresence(() => setV((x) => x + 1)), []);
  return v;
}

/** Присутствие конкретного пользователя. */
export function usePresence(userId?: number): UserPresence | undefined {
  const [, setV] = useState(0);
  useEffect(() => {
    if (userId == null) return;
    const update = () => setV((x) => x + 1);
    update();
    return subscribePresence(update);
  }, [userId]);
  return userId != null ? store.get(userId) : undefined;
}

/** Менеджер присутствия (один раз на приложение). */
export function usePresenceManager(): void {
  useEffect(() => initPresence(), []);
}
