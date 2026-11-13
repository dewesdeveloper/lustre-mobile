import { L } from '@/constants/lustre';

export interface NewsCategory {
  id: string;
  label: string;
}

/** Категории ленты — те же, что на десктопе. */
export const NEWS_CATEGORIES: NewsCategory[] = [
  { id: 'all', label: 'Все' },
  { id: 'update', label: 'Обновления' },
  { id: 'game', label: 'Игры' },
  { id: 'cosmetics', label: 'Оформление' },
  { id: 'subscription', label: 'Подписки' },
  { id: 'community', label: 'Сообщество' },
  { id: 'general', label: 'Общее' },
];

export interface CategoryMeta {
  label: string;
  fg: string;
  bg: string;
  border: string;
}

export const NEWS_CAT_META: Record<string, CategoryMeta> = {
  general: { label: 'Общее', fg: 'rgba(244,244,246,0.5)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
  game: { label: 'Игры', fg: L.accent, bg: 'rgba(255,0,110,0.1)', border: 'rgba(255,0,110,0.2)' },
  update: { label: 'Обновление', fg: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.2)' },
  cosmetics: { label: 'Оформление', fg: L.violet, bg: 'rgba(131,56,236,0.1)', border: 'rgba(131,56,236,0.2)' },
  subscription: { label: 'Подписки', fg: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
  community: { label: 'Сообщество', fg: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.2)' },
};

export function newsCatMeta(category?: string): CategoryMeta {
  return NEWS_CAT_META[category || ''] || NEWS_CAT_META.general;
}

export function fmtNewsDate(d?: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Все картинки новости для галереи: обложка + изображения из контента
 * (markdown `![alt](url)` и HTML `<img src="...">`).
 */
export function newsImages(content?: string, cover?: string): string[] {
  const urls: string[] = [];
  const push = (u?: string) => {
    const url = (u || '').trim();
    if (url && !urls.includes(url)) urls.push(url);
  };
  push(cover);
  const text = content || '';
  const md = text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g);
  if (md) {
    md.forEach((m) => push(m.replace(/!\[[^\]]*\]\(/, '').replace(/\)$/, '')));
  }
  const html = text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const m of html) push(m[1]);
  return urls;
}

/** Первое предложение/фрагмент для превью в списке. */
export function newsExcerpt(content?: string, max = 160): string {
  const plain = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}
