// Качество медиа в звонках (мобильный LiveKit): SD для обычных, HD для Pro.
// Меню выбора на мобильном нет — тариф определяется подпиской автоматически.

export type MediaQuality = 'sd' | 'hd';

export interface QualityPreset {
  id: MediaQuality;
  label: string;
  short: string;
  resolution: { width: number; height: number };
  frameRate: number;
  cameraBitrate: number;
  screenBitrate: number;
}

export const QUALITY_PRESETS: Record<MediaQuality, QualityPreset> = {
  sd: {
    id: 'sd',
    label: 'SD · 720p · 30 к/с',
    short: 'SD',
    resolution: { width: 1280, height: 720 },
    frameRate: 30,
    cameraBitrate: 1_500_000,
    screenBitrate: 2_500_000,
  },
  hd: {
    id: 'hd',
    label: 'HD · 1080p · 60 к/с',
    short: 'HD',
    resolution: { width: 1920, height: 1080 },
    frameRate: 60,
    cameraBitrate: 3_000_000,
    screenBitrate: 6_000_000,
  },
};

let pro = false;
// null — выбор не задан (по умолчанию Pro → HD, остальные → SD).
let chosen: MediaQuality | null = null;

export function setProStatus(value: boolean) {
  pro = !!value;
}

export function isProUser(): boolean {
  return pro;
}

export function canUseHd(): boolean {
  return pro;
}

export function getQuality(): MediaQuality {
  if (chosen === 'sd') return 'sd';
  if (chosen === 'hd') return pro ? 'hd' : 'sd';
  return pro ? 'hd' : 'sd';
}

export function setQuality(quality: MediaQuality): MediaQuality {
  chosen = quality === 'hd' && !pro ? 'sd' : quality;
  return chosen;
}

export function getPreset(quality: MediaQuality = getQuality()): QualityPreset {
  return QUALITY_PRESETS[quality];
}
