import api from './client';

export interface PrivacySettings {
  profile_visibility: 'public' | 'friends' | 'private';
  friends_visibility: 'public' | 'friends' | 'private';
  /** Кто видит ленту активности в профиле */
  activity_visibility: 'public' | 'friends' | 'private';
  /** Кто видит игры в профиле (старые серверы поля не присылают) */
  library_visibility?: 'public' | 'friends' | 'private';
  friend_requests: 'everyone' | 'nobody';
  dms: 'everyone' | 'friends';
  calls: 'everyone' | 'friends';
  show_online: boolean;
}

export async function getPrivacy(): Promise<PrivacySettings> {
  const res = await api.get('/privacy/');
  return res.data;
}

export async function updatePrivacy(patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const res = await api.put('/privacy/', patch);
  return res.data;
}
