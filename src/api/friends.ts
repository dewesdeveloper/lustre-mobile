import api from './client';

export interface FriendProfile {
  display_name?: string;
  avatar_url?: string;
}

export interface FriendUser {
  id: number;
  username: string;
  friend_code?: string;
  role?: string;
  profile?: FriendProfile;
}

export interface Friend {
  id: number;
  online_status: 'online' | 'offline' | string;
  friend_details: FriendUser;
}

export interface PendingRequest {
  id: number;
  user_id: number;
  friend_id: number;
  status: string;
  created_at: string;
  sender_details?: FriendUser;
  receiver_details?: FriendUser;
}

export interface PendingRequests {
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
}

export interface FoundUser {
  id: number;
  username: string;
  friend_code: string;
  profile?: FriendProfile;
}

export async function getFriends(): Promise<Friend[]> {
  const res = await api.get('/friends/list');
  return Array.isArray(res.data) ? (res.data as Friend[]) : [];
}

export async function getPendingRequests(): Promise<PendingRequests> {
  const res = await api.get('/friends/pending');
  const data = (res.data ?? {}) as Partial<PendingRequests>;
  return {
    incoming: Array.isArray(data.incoming) ? data.incoming : [],
    outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
  };
}

export async function findByCode(code: string): Promise<FoundUser> {
  const res = await api.get(`/friends/find/${encodeURIComponent(code.trim())}`);
  return res.data as FoundUser;
}

export async function sendFriendRequest(payload: { friend_id?: number; friend_code?: string }): Promise<void> {
  await api.post('/friends/request', payload);
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  await api.post('/friends/accept', { request_id: requestId });
}

export async function deleteFriendRequest(requestId: number): Promise<void> {
  await api.delete('/friends/request', { data: { request_id: requestId } });
}

export async function removeFriend(friendId: number): Promise<void> {
  await api.delete('/friends/remove', { data: { friend_id: friendId } });
}
