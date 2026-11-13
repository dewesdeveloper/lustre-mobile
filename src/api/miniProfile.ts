import api from './client';

/** Компактный профиль: уровень, XP и сводная статистика (для дашборда). */
export interface MiniProfile {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  level?: number;
  xp?: number;
  level_xp?: number;
  level_goal?: number;
  is_pro?: boolean;
  stats?: {
    games?: number;
    favorites?: number;
    achievements?: number;
    friends?: number;
    playtime_ms?: number;
  };
}

export async function getMiniProfile(username?: string): Promise<MiniProfile | null> {
  if (!username) return null;
  try {
    const res = await api.get(`/user/${encodeURIComponent(username)}/mini`);
    return (res.data as MiniProfile) ?? null;
  } catch {
    return null;
  }
}
