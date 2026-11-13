// Полноэкранный входящий звонок (Android).
//
// Схема: бэкенд, не застав абонента в сети, шлёт data-only push с type=call_incoming.
// Приложение просыпается, фоновая задача (expo-task-manager) вызывает notifee,
// который показывает полноэкранное уведомление «Входящий звонок» с действиями
// «Принять»/«Отклонить». По «Принять» приложение открывается и принимает звонок.
//
// iOS-путь (PushKit + CallKit) — отдельный этап.

import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import notifee, {
  AndroidImportance,
  AndroidCategory,
  EventType,
  type Event as NotifeeEvent,
} from '@notifee/react-native';

import { acceptCallById, declineCallById } from './call';
import { connectChat } from './chat';

const TASK = 'INCOMING_CALL';
const CHANNEL_ID = 'calls';

export interface IncomingCallData {
  type?: string;
  call_id?: string;
  conversation_id?: number;
  caller_id?: number;
  caller_username?: string;
}

let enabled = false;

export function incomingCallAvailable(): boolean {
  return enabled;
}

/** Инициализация: канал notifee, фоновая задача, обработчики действий. */
export async function setupIncomingCall(): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS — PushKit/CallKit, отдельно
  try {
    await notifee.requestPermission();
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Звонки',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
    enabled = true;
  } catch (e) {
    console.warn('[incomingCall] notifee недоступен:', e);
    return;
  }

  if (!TaskManager.isTaskDefined(TASK)) {
    TaskManager.defineTask(TASK, async ({ data, error }) => {
      if (error) return;
      const d = (data as { data?: IncomingCallData } | undefined)?.data;
      if (d?.type === 'call_incoming') await showIncomingCall(d);
    });
  }
  try {
    await Notifications.registerTaskAsync(TASK);
  } catch (e) {
    console.warn('[incomingCall] registerTaskAsync:', e);
  }

  notifee.onForegroundEvent((event) => void handleEvent(event));
  notifee.onBackgroundEvent(async (event) => {
    await handleEvent(event);
  });
}

/** Показать полноэкранное уведомление о входящем звонке. */
export async function showIncomingCall(d: IncomingCallData): Promise<void> {
  if (!enabled || !d?.call_id) return;
  const name = d.caller_username || 'Пользователь';
  try {
    await notifee.displayNotification({
      id: `call-${d.call_id}`,
      title: 'Входящий звонок',
      body: `${name} звонит вам`,
      data: {
        type: 'call_incoming',
        call_id: d.call_id,
        conversation_id: String(d.conversation_id ?? ''),
        caller_id: String(d.caller_id ?? ''),
        caller_username: name,
      },
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.CALL,
        ongoing: true,
        autoCancel: false,
        // Полноэкранный вызов (поверх блокировки) + ответ по тапу
        fullScreenAction: { id: 'incoming-call', mainComponent: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          { title: 'Отклонить', pressAction: { id: 'decline' } },
          { title: 'Принять', pressAction: { id: 'answer', launchActivity: 'default' } },
        ],
      },
    });
  } catch (e) {
    console.warn('[incomingCall] display:', e);
  }
}

async function handleEvent(event: NotifeeEvent): Promise<void> {
  if (event.type !== EventType.ACTION_PRESS && event.type !== EventType.PRESS) return;
  const action = event.detail?.pressAction?.id;
  const raw = event.detail?.notification?.data as Record<string, string> | undefined;
  const callId = raw?.call_id;
  if (!callId) return;

  const peer = {
    id: Number(raw?.caller_id || 0),
    username: raw?.caller_username || 'Пользователь',
  };

  await notifee.cancelNotification(`call-${callId}`).catch(() => {});

  if (action === 'decline') {
    declineCallById(callId);
    return;
  }
  // 'answer' | 'default'
  connectChat();
  acceptCallById(callId, peer);
}
