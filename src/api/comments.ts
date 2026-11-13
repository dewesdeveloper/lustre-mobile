import api from './client';

/** Комментарий на стене профиля. */
export interface WallComment {
  id: number;
  profile_id: number;
  author_id: number;
  parent_id: number;
  content: string;
  created_at: string;
  likes: number;
  liked: boolean;
  author: {
    id: number;
    username: string;
    profile?: { avatar_url?: string; display_name?: string; is_pro?: boolean };
  };
}

/** Комментарии стены профиля (GET /comments/:profileId). */
export async function getWallComments(profileId: number): Promise<WallComment[]> {
  const res = await api.get(`/comments/${profileId}`);
  return Array.isArray(res.data) ? (res.data as WallComment[]) : [];
}

/** Новый комментарий или ответ (parentId = 0 — корневой). */
export async function postWallComment(
  profileId: number,
  content: string,
  parentId = 0,
): Promise<WallComment> {
  const res = await api.post('/comments', { profile_id: profileId, content, parent_id: parentId });
  return res.data as WallComment;
}

/** Лайк/снятие лайка с комментария. */
export async function toggleCommentLike(commentId: number): Promise<{ likes: number; liked: boolean }> {
  const res = await api.post(`/comments/${commentId}/like`);
  return res.data as { likes: number; liked: boolean };
}

/** Удаление комментария (вместе с ответами). */
export async function deleteWallComment(commentId: number): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
