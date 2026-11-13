import api from './client';

// ICE-серверы (STUN + TURN) для P2P-звонков. Берём с бэкенда,
// чтобы TURN-креды не были вшиты в приложение. Кэшируем на сессию.

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const FALLBACK: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

let cached: IceServer[] | null = null;
let inflight: Promise<IceServer[]> | null = null;

export async function getIceServers(): Promise<IceServer[]> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = api
    .get('/calls/ice')
    .then((r) => {
      const list = (r.data as { iceServers?: IceServer[] } | undefined)?.iceServers;
      cached = Array.isArray(list) && list.length ? list : FALLBACK;
      return cached;
    })
    .catch(() => {
      cached = FALLBACK;
      return cached;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetIceCache() {
  cached = null;
}
