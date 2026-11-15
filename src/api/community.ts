import api from './client';

export interface CommunityTheme {
  id: number;
  name: string;
}

export interface CommunityCreator {
  id: number;
  username: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
    avatar_frame_url?: string;
    frame_id?: string;
    avatar_frame_scale?: number;
    is_pro?: boolean;
  };
}

export interface CommunityGame {
  ID: number;
  title: string;
  header_image?: string;
  banner_url?: string;
  is_adult?: boolean;
}

export interface Community {
  ID: number;
  name: string;
  description: string;
  cover_url: string;
  is_private: boolean;
  invite_code?: string;
  game_id: number;
  game: CommunityGame | null;
  theme_id: number;
  theme: CommunityTheme;
  creator_id: number;
  creator: CommunityCreator;
  members_count: number;
  CreatedAt?: string;
}

export interface CreateCommunityPayload {
  name: string;
  description: string;
  cover_url: string;
  game_id: number;
  theme_id: number;
  is_private: boolean;
}

export interface InvitePreview {
  id: number;
  name: string;
  game_title: string;
  theme_name: string;
  is_private: boolean;
}

export interface CommunityImage {
  ID: number;
  community_id: number;
  author_id: number;
  url: string;
  author?: CommunityCreator;
  CreatedAt?: string;
}

export interface CommunityPost {
  ID: number;
  community_id: number;
  author_id: number;
  title: string;
  content: string;
  author?: CommunityCreator;
  CreatedAt?: string;
}

export interface CommunityDetails {
  community: Community;
  is_member: boolean;
}

export interface CommunityStats {
  communities: number;
  discussions: number;
  members: number;
  online_users: number;
}

export interface CommunityPostComment {
  ID: number;
  post_id: number;
  author_id: number;
  content: string;
  author?: CommunityCreator;
  CreatedAt?: string;
}

export interface UploadFile {
  uri: string;
  name: string;
  mimeType?: string;
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const res = await api.get('/stats/community');
  return res.data as CommunityStats;
}

export async function getCommunities(): Promise<Community[]> {
  const res = await api.get('/communities/');
  return Array.isArray(res.data) ? (res.data as Community[]) : [];
}

export async function getCommunity(id: number): Promise<CommunityDetails> {
  const res = await api.get(`/communities/${id}`);
  return res.data as CommunityDetails;
}

export async function createCommunity(payload: CreateCommunityPayload): Promise<Community> {
  const res = await api.post('/communities/', payload);
  return res.data as Community;
}

export async function deleteCommunity(id: number): Promise<void> {
  await api.delete(`/communities/${id}`);
}

export async function getCommunityThemes(): Promise<CommunityTheme[]> {
  const res = await api.get('/themes/');
  return Array.isArray(res.data) ? (res.data as CommunityTheme[]) : [];
}

export async function getCommunityGames(): Promise<CommunityGame[]> {
  const res = await api.get('/games/');
  return Array.isArray(res.data) ? (res.data as CommunityGame[]) : [];
}

// Ссылка на сайт: откроется у любого получателя, в отличие от схемы приложения
export function buildInviteLink(code: string): string {
  return `https://lustrehub.pro/community/invite/${code}`;
}

export async function getCommunityInvite(id: number): Promise<string> {
  const res = await api.get(`/communities/${id}/invite`);
  return (res.data as { invite_code: string }).invite_code;
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const res = await api.get(`/community-invites/${code}`);
  return res.data as InvitePreview;
}

export async function joinByInvite(code: string): Promise<Community> {
  const res = await api.post(`/community-invites/${code}`);
  return res.data as Community;
}

export async function getCommunityImages(communityId: number): Promise<CommunityImage[]> {
  const res = await api.get(`/communities/${communityId}/images`);
  return Array.isArray(res.data) ? (res.data as CommunityImage[]) : [];
}

export async function addCommunityImage(communityId: number, url: string): Promise<CommunityImage> {
  const res = await api.post(`/communities/${communityId}/images`, { url });
  return res.data as CommunityImage;
}

export async function deleteCommunityImage(imageId: number): Promise<void> {
  await api.delete(`/community-images/${imageId}`);
}

export async function getCommunityPosts(communityId: number): Promise<CommunityPost[]> {
  const res = await api.get(`/communities/${communityId}/posts`);
  return Array.isArray(res.data) ? (res.data as CommunityPost[]) : [];
}

export async function createCommunityPost(
  communityId: number,
  payload: { title: string; content: string },
): Promise<CommunityPost> {
  const res = await api.post(`/communities/${communityId}/posts`, payload);
  return res.data as CommunityPost;
}

export async function deleteCommunityPost(postId: number): Promise<void> {
  await api.delete(`/community-posts/${postId}`);
}

export async function getCommunityPost(
  postId: number,
): Promise<{ post: CommunityPost; community: Community }> {
  const res = await api.get(`/community-posts/${postId}`);
  return res.data as { post: CommunityPost; community: Community };
}

export async function getPostComments(postId: number): Promise<CommunityPostComment[]> {
  const res = await api.get(`/community-posts/${postId}/comments`);
  return Array.isArray(res.data) ? (res.data as CommunityPostComment[]) : [];
}

export async function addPostComment(postId: number, content: string): Promise<CommunityPostComment> {
  const res = await api.post(`/community-posts/${postId}/comments`, { content });
  return res.data as CommunityPostComment;
}

export async function deletePostComment(commentId: number): Promise<void> {
  await api.delete(`/community-post-comments/${commentId}`);
}

export async function uploadCommunityImage(file: UploadFile): Promise<string> {
  const fd = new FormData();
  fd.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'image/jpeg',
  } as unknown as Blob);
  const res = await api.post('/upload/communities', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (res.data as { url: string }).url;
}

// ---- Общие ленты сообществ (как в лаунчере: «Скриншоты» и «Мастерская») ----

export interface FeedCommunityRef {
  id: number;
  name: string;
  is_adult: boolean;
}

export interface FeedScreenshot extends CommunityImage {
  community: FeedCommunityRef;
}

export interface FeedWorkshopItem {
  ID: number;
  community_id: number;
  author_id: number;
  title: string;
  description: string;
  url: string;
  image_url: string;
  author?: CommunityCreator;
  community: FeedCommunityRef;
}

/** Размер страницы ленты на сервере */
export const FEED_PAGE = 48;

export async function getScreenshotsFeed(beforeId?: number): Promise<FeedScreenshot[]> {
  const res = await api.get('/communities/screenshots', { params: beforeId ? { before_id: beforeId } : undefined });
  return Array.isArray(res.data) ? (res.data as FeedScreenshot[]) : [];
}

export async function getWorkshopFeed(beforeId?: number): Promise<FeedWorkshopItem[]> {
  const res = await api.get('/communities/workshop', { params: beforeId ? { before_id: beforeId } : undefined });
  return Array.isArray(res.data) ? (res.data as FeedWorkshopItem[]) : [];
}

export async function deleteWorkshopItem(id: number): Promise<void> {
  await api.delete(`/community-workshop/${id}`);
}
