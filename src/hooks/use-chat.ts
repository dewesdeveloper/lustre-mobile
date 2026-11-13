import { useEffect, useRef } from 'react';

import { connectChat, disconnectChat, onChatEvent, onChatState } from '@/api/chat';
import { useAuth } from '@/context/AuthContext';

/** Держит WebSocket чата подключённым, пока пользователь авторизован. */
export function useChatConnection() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    connectChat();
    return () => disconnectChat();
  }, [userId]);
}

/** Подписка на события чата с актуальным обработчиком (без переподписок). */
export function useChatEvents(handler: (data: { type?: string } & Record<string, unknown>) => void): void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    const off = onChatEvent((data) => ref.current(data));
    return () => {
      off();
    };
  }, []);
}

/** Подписка на состояние соединения. */
export function useChatState(handler: (connected: boolean) => void): void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    const off = onChatState((value) => ref.current(value));
    return () => {
      off();
    };
  }, []);
}
