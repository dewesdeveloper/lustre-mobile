import { useSyncExternalStore } from 'react';

import api from './client';
import { onChatEvent, onChatState } from './chat';

export interface ActiveGroupCallUser {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

/** Идущий звонок группы: виден всем её участникам, даже если им не звонили. */
export interface ActiveGroupCall {
  call_id: string;
  group_id: number;
  started_at: string;
  participants: ActiveGroupCallUser[];
}

let calls = new Map<number, ActiveGroupCall>();
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;
// Событие пришло, пока шёл запрос, — его ответ уже устарел
let eventSeq = 0;

function publish(next: Map<number, ActiveGroupCall>) {
  calls = next;
  listeners.forEach((l) => l());
}

async function refresh() {
  const seq = eventSeq;
  try {
    const res = await api.get('/groups/active-calls');
    if (!detach) return;
    if (seq !== eventSeq) {
      void refresh();
      return;
    }
    const list: ActiveGroupCall[] = res.data?.calls ?? [];
    publish(new Map(list.map((c) => [c.group_id, c])));
  } catch {
    // покажем при следующем обновлении
  }
}

function attach() {
  const offEvent = onChatEvent((raw) => {
    const data = raw as { type?: string; group_id?: number; active?: boolean; call?: ActiveGroupCall | null };
    if (data.type !== 'group.call.state' || !data.group_id) return;
    eventSeq++;
    const next = new Map(calls);
    if (data.active && data.call) next.set(data.group_id, data.call);
    else next.delete(data.group_id);
    publish(next);
  });
  // onChatState вызывает обработчик сразу, поэтому detach задаём до подписки:
  // refresh по нему определяет, что подписка ещё жива.
  let offState: (() => void) | null = null;
  detach = () => {
    offEvent();
    offState?.();
  };
  // Связь появилась (в том числе после фона) — события за время без неё потеряны
  offState = onChatState((connected) => {
    if (connected) void refresh();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!detach) attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detach?.();
      detach = null;
      calls = new Map();
    }
  };
}

/** Идущие звонки всех групп пользователя (group_id → звонок). */
export function useGroupActiveCalls(): Map<number, ActiveGroupCall> {
  return useSyncExternalStore(subscribe, () => calls);
}
