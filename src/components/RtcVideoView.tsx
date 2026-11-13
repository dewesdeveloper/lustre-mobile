import { type ComponentType } from 'react';

type RTCViewProps = {
  streamURL: string;
  style?: object;
  objectFit?: 'contain' | 'cover';
  mirror?: boolean;
  zOrder?: number;
};

// @livekit/react-native-webrtc — нативный модуль, доступный только в dev/release-сборке.
// В Expo Go он бросает исключение при импорте, поэтому грузим лениво на уровне модуля
// (не в рендере) и просто не рендерим видео, если модуль недоступен.
let RTCViewComp: ComponentType<RTCViewProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RTCViewComp = require('@livekit/react-native-webrtc').RTCView as ComponentType<RTCViewProps>;
} catch {
  RTCViewComp = null;
}

export function isVideoSupported(): boolean {
  return RTCViewComp !== null;
}

/** Видео-стрим через RTCView; null-safe, если модуль недоступен. */
export default function RtcVideoView(props: RTCViewProps) {
  if (!RTCViewComp) return null;
  return <RTCViewComp {...props} />;
}
