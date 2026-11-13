import { useEffect, useState } from 'react';

import { getCallState, initCallManager, subscribeCall, type CallState } from '@/api/call';
import {
  getGroupCallState, initGroupCallManager, subscribeGroupCall, type GroupCallState,
} from '@/api/groupCall';

/** Текущее состояние звонка. */
export function useCall(): CallState {
  const [state, setState] = useState<CallState>(getCallState());
  useEffect(() => subscribeCall(setState), []);
  return state;
}

/** Инициализирует обработчик входящих звонков (один раз на приложение). */
export function useCallManager(): void {
  useEffect(() => initCallManager(), []);
}

/** Текущее состояние группового звонка. */
export function useGroupCall(): GroupCallState {
  const [state, setState] = useState<GroupCallState>(getGroupCallState());
  useEffect(() => subscribeGroupCall(setState), []);
  return state;
}

/** Инициализирует обработчик групповых звонков (один раз на приложение). */
export function useGroupCallManager(): void {
  useEffect(() => initGroupCallManager(), []);
}
