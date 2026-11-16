// Заглушённые собеседники: их личные сообщения приходят без звука. Список на сервере —
// общий с лаунчером; сервер сам отправляет такие push в тихий канал «quiet».
import { useEffect, useState } from 'react';
import api from './client';

let ids = new Set<number>();
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function syncChatMutes(): Promise<void> {
  try {
    const { data } = await api.get<{ user_ids: number[] }>('/chat/mutes');
    ids = new Set((data?.user_ids || []).map(Number));
    loaded = true;
    emit();
  } catch { /* офлайн — оставляем как было */ }
}

export async function setChatMuted(userId: number, muted: boolean): Promise<void> {
  if (muted) await api.put(`/chat/mutes/${userId}`);
  else await api.delete(`/chat/mutes/${userId}`);
  const next = new Set(ids);
  if (muted) next.add(userId); else next.delete(userId);
  ids = next;
  emit();
}

/** Заглушён ли собеседник (список подгружается при первом использовании) */
export function useChatMuted(userId: number): boolean {
  const [muted, setMuted] = useState(() => ids.has(userId));
  useEffect(() => {
    const sync = () => setMuted(ids.has(userId));
    listeners.add(sync);
    sync();
    if (!loaded) void syncChatMutes();
    return () => { listeners.delete(sync); };
  }, [userId]);
  return muted;
}
