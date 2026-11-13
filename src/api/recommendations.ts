import api from './client';
import { hasAdultConsent } from './adultConsent';

export interface RecTag {
  id: number;
  name: string;
  score: number;
}

export interface RecGame {
  ID: number;
  title: string;
  description?: string;
  header_image?: string;
  banner_url?: string;
  age_rating?: string;
  is_adult?: boolean;
  tags?: { id: number; name: string; category?: string }[];
}

export interface RecItem {
  id: number;
  type: string;
  name: string;
  price: number;
  rarity: string;
  scope?: string;
  image_url: string;
  payload: string;
  tags?: { id: number; name: string }[];
}

export interface RecommendationSignals {
  reviews: number;
  favorites: number;
  library: number;
  communities: number;
  purchases: number;
}

export interface Recommendations {
  source?: string;
  tags: RecTag[];
  games: RecGame[];
  items: RecItem[];
  signals: RecommendationSignals;
}

export type RecSource = 'all' | 'reviews' | 'favorites' | 'library' | 'communities' | 'customization';

const EMPTY_SIGNALS: RecommendationSignals = {
  reviews: 0,
  favorites: 0,
  library: 0,
  communities: 0,
  purchases: 0,
};

function params(source?: string) {
  return source && source !== 'all' ? { source } : undefined;
}

/** Только игры. Безопасная обёртка для домашнего экрана — ошибки не бросает. */
// Игры 18+ скрыты и в подборках, пока пользователь не подтвердил возраст
function withoutHiddenAdult(games: RecGame[]): RecGame[] {
  return hasAdultConsent() ? games : games.filter((g) => !g.is_adult);
}

export async function getRecommendations(source?: string): Promise<RecGame[]> {
  try {
    const res = await api.get('/recommendations', { params: params(source) });
    const games = (res.data as { games?: RecGame[] } | undefined)?.games;
    return Array.isArray(games) ? withoutHiddenAdult(games) : [];
  } catch {
    return [];
  }
}

/** Полный ответ: сигналы, теги, игры, товары. Ошибки пробрасываются — обрабатывайте через apiError(). */
export async function getRecommendationsFull(source?: RecSource | string): Promise<Recommendations> {
  const res = await api.get('/recommendations', { params: params(source) });
  const data = (res.data ?? {}) as Partial<Recommendations>;
  return {
    source: data.source,
    tags: Array.isArray(data.tags) ? data.tags : [],
    games: Array.isArray(data.games) ? withoutHiddenAdult(data.games) : [],
    items: Array.isArray(data.items) ? data.items : [],
    signals: data.signals ?? EMPTY_SIGNALS,
  };
}
