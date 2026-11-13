// Дизайн-токены Lustre. Акцент, фон и рамки «живые» — читаются из текущей
// темы лаунчера (src/theme/appTheme.ts), поэтому перекрашиваются динамически.
// Стили экранов создаются через themedStyles(), который пересоздаёт их при
// смене темы — см. src/theme/themedStyles.ts.
import { getThemeColors } from '@/theme/appTheme';

export const L = {
  get bg() {
    return getThemeColors().bg;
  },
  card: '#141419',
  cardAlt: '#1b1b21',
  /** розовая рамка TL ≈ 30% акцента */
  get border() {
    return `${getThemeColors().accent}4D`;
  },
  /** ≈ 60% акцента */
  get borderStrong() {
    return `${getThemeColors().accent}99`;
  },
  get accent() {
    return getThemeColors().accent;
  },
  get violet() {
    return getThemeColors().violet;
  },
  get cyan() {
    return getThemeColors().cyan;
  },
  text: '#f4f4f6',
  muted: '#8b8b93',
  danger: '#ff4d4f',
  success: '#34d399',
  /** Нейтральная оценка (отзыв «смешанные впечатления») */
  neutral: '#fcd34d',
};

/** Имена загруженных шрифтов (expo-font), аналоги десктопных tl-pixel / tl-term. */
export const F = {
  /** Tiny5 — аналог tl-pixel (заголовки), полная кириллица */
  pixel: 'Tiny5',
  /** JetBrains Mono — аналог tl-term (основной текст, полная кириллица) */
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;
