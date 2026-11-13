import type { CommunityCreator } from '@/api/community';

export function authorName(creator?: CommunityCreator): string {
  return creator?.profile?.display_name || creator?.username || 'Игрок';
}

export function avatarUri(creator?: CommunityCreator): string | null {
  return creator?.profile?.avatar_url || null;
}

export function isPro(creator?: CommunityCreator): boolean {
  return !!creator?.profile?.is_pro;
}

export function initials(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

export function formatDate(value?: string): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return '';
  }
}

export function formatDateTime(value?: string): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
