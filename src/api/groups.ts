import api from './client';

export interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  content: string;
  kind?: 'text' | 'call' | 'image' | 'video' | 'file' | string;
  call_status?: string;
  call_duration?: number;
  attachment_url?: string;
  attachment_name?: string;
  attachment_mime?: string;
  attachment_size?: number;
  created_at: string;
  // Редактирование / удаление / закреп / пересылка
  reply_to_id?: number | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  pinned_at?: string | null;
  forwarded_from?: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  avatar_url: string;
  owner_id: number;
  members_count: number;
  last_message: GroupMessage | null;
  unread: number;
}

export interface GroupMember {
  id: number;
  username: string;
  avatar_url?: string;
  is_pro?: boolean;
  is_owner?: boolean;
}

export interface GroupDetails {
  id: number;
  name: string;
  avatar_url: string;
  owner_id: number;
  members: GroupMember[];
}

export async function getGroups(): Promise<GroupSummary[]> {
  const res = await api.get('/groups/');
  return Array.isArray(res.data) ? (res.data as GroupSummary[]) : [];
}

export async function getGroup(id: number): Promise<GroupDetails> {
  const res = await api.get(`/groups/${id}`);
  return res.data as GroupDetails;
}

export async function getGroupMessages(groupId: number, limit = 50): Promise<GroupMessage[]> {
  const res = await api.get(`/groups/${groupId}/messages?limit=${limit}`);
  return Array.isArray(res.data) ? (res.data as GroupMessage[]) : [];
}

export async function createGroup(payload: {
  name: string;
  avatar_url?: string;
  member_ids: number[];
}): Promise<{ id: number }> {
  const res = await api.post('/groups/', payload);
  return res.data as { id: number };
}

export async function addGroupMembers(groupId: number, userIds: number[]): Promise<void> {
  await api.post(`/groups/${groupId}/members`, { user_ids: userIds });
}

export async function removeGroupMember(groupId: number, userId: number): Promise<void> {
  await api.delete(`/groups/${groupId}/members/${userId}`);
}

export async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(`/groups/${groupId}`);
}

/** Скрыть/показать группу у себя («удалить чат у себя»). */
export async function hideGroup(groupId: number): Promise<boolean> {
  const res = await api.post(`/groups/${groupId}/hide`);
  return !!res.data?.hidden;
}
