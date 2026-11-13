import { useEffect, useState } from 'react';

import { findLauncherTheme } from '@/constants/themes';

/** Актуальные цвета приложения (тема лаунчера из магазина). */
export interface AppThemeColors {
  accent: string;
  violet: string;
  cyan: string;
  bg: string;
}

function toColors(id?: string | null): AppThemeColors {
  const t = findLauncherTheme(id);
  return { accent: t.accent, violet: t.violet, cyan: t.cyan, bg: t.mainBg };
}

let colors: AppThemeColors = toColors(null);
const listeners = new Set<() => void>();

export function getThemeColors(): AppThemeColors {
  return colors;
}

/** Применить тему по id из профиля (launcher_theme_id). */
export function setLauncherThemeById(id?: string | null): void {
  const next = toColors(id);
  if (next.accent === colors.accent && next.violet === colors.violet && next.bg === colors.bg) return;
  colors = next;
  listeners.forEach((l) => l());
}

export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Подписка на смену темы — перерисовывает компонент при смене. */
export function useAppTheme(): AppThemeColors {
  const [, setV] = useState(0);
  useEffect(() => subscribeTheme(() => setV((x) => x + 1)), []);
  return colors;
}

/** '#FF006E' + '1f' -> '#FF006E1f' (8-символьный hex с альфой). */
export function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}
