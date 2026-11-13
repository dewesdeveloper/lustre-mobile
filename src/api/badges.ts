import api from './client';

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'launcher' | 'game' | 'community';

export interface Badge {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  category: BadgeCategory;
  secret?: boolean;
}

export interface BadgeWithStatus extends Badge {
  earned: boolean;
  awarded_at: string | null;
  holders_percent?: number;
}

export interface UserBadge {
  ID: number;
  user_id: number;
  badge_id: number;
  badge: Badge;
  CreatedAt?: string;
  holders_percent?: number;
}

export interface BadgeSummaryItem {
  badge: Badge;
  awarded_at: string;
  holders_percent: number;
}

export interface BadgeSummary {
  earned: number;
  total_badges: number;
  trophy_score: number;
  percentile: number;
  rank: string;
  next_rank_at: number;
  rarest: BadgeSummaryItem[];
  last: BadgeSummaryItem[];
}

/** Каталог значков со статусом текущего пользователя. */
export async function getBadges(): Promise<BadgeWithStatus[]> {
  const res = await api.get('/badges/');
  return Array.isArray(res.data) ? (res.data as BadgeWithStatus[]) : [];
}

/** Значки конкретного пользователя. */
export async function getUserBadges(userId: number): Promise<UserBadge[]> {
  const res = await api.get(`/badges/user/${userId}`);
  return Array.isArray(res.data) ? (res.data as UserBadge[]) : [];
}

/** Сводка: ранг, трофейный счёт, редчайшие и последние значки. */
export async function getBadgeSummary(userId: number): Promise<BadgeSummary> {
  const res = await api.get(`/badges/summary/${userId}`);
  return res.data as BadgeSummary;
}

/** Цвета/подписи редкости для RN-стилей. */
export const rarityStyles: Record<BadgeRarity, { label: string; color: string; bg: string; border: string }> = {
  common: { label: 'Обычный', color: '#9CA3AF', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)' },
  rare: { label: 'Редкий', color: '#22D3EE', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.35)' },
  epic: { label: 'Эпический', color: '#A78BFA', bg: 'rgba(131,56,236,0.14)', border: 'rgba(131,56,236,0.45)' },
  legendary: { label: 'Легендарный', color: '#FFB020', bg: 'rgba(255,176,32,0.10)', border: 'rgba(255,176,32,0.45)' },
};

export const categoryLabels: Record<BadgeCategory, string> = {
  launcher: 'Лаунчер',
  game: 'Игры',
  community: 'Сообщества',
};
