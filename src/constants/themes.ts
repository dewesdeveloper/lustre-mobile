// Темы лаунчера — порт с десктопа (LustreHub/src/components/profileThemes.ts).
// На телефоне перекрашивают акцент и фон приложения.

export interface LauncherTheme {
  id: string;
  name: string;
  accent: string;
  violet: string;
  cyan: string;
  mainBg: string;
}

export const LAUNCHER_THEMES: LauncherTheme[] = [
  { id: 'aurora-pink', name: 'Аврора розовая', accent: '#FF006E', violet: '#8338EC', cyan: '#3A86FF', mainBg: '#050407' },
  { id: 'azure-rush', name: 'Лазурный порыв', accent: '#3A86FF', violet: '#00C2FF', cyan: '#00f5d4', mainBg: '#04070d' },
  { id: 'toxic-reactor', name: 'Токсичный реактор', accent: '#39FF14', violet: '#00E5A0', cyan: '#39FF14', mainBg: '#040805' },
  { id: 'ember-forge', name: 'Кузница углей', accent: '#FF4D00', violet: '#FF8A00', cyan: '#FF4D00', mainBg: '#080504' },
  { id: 'phantom-pulse', name: 'Фантомный пульс', accent: '#8338EC', violet: '#FF006E', cyan: '#8338EC', mainBg: '#070510' },
];

export const DEFAULT_LAUNCHER_THEME = LAUNCHER_THEMES[0];

const CUSTOM_THEME_PREFIX = 'custom#';

export const isCustomThemeId = (id?: string | null): boolean => !!id && id.startsWith(CUSTOM_THEME_PREFIX);

/** custom#FF006E#8338EC -> { accent: '#FF006E', violet: '#8338EC' } */
export function parseCustomThemeId(id: string): { accent: string; violet: string } | null {
  const parts = id.split('#');
  if (parts.length !== 3) return null;
  const hex = (s: string) => /^[0-9a-fA-F]{6}$/.test(s);
  if (!hex(parts[1]) || !hex(parts[2])) return null;
  return { accent: `#${parts[1]}`, violet: `#${parts[2]}` };
}

export function findLauncherTheme(id?: string | null): LauncherTheme {
  if (isCustomThemeId(id)) {
    const c = parseCustomThemeId(id!);
    if (c) {
      return {
        id: id!,
        name: 'Своя тема',
        accent: c.accent,
        violet: c.violet,
        cyan: c.violet,
        mainBg: DEFAULT_LAUNCHER_THEME.mainBg,
      };
    }
  }
  return LAUNCHER_THEMES.find((t) => t.id === id) || DEFAULT_LAUNCHER_THEME;
}
