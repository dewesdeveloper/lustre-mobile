import api from './client';

export interface ReviewAuthorProfile {
  display_name?: string;
  avatar_url?: string;
  is_pro?: boolean;
}

export interface ReviewAuthor {
  id?: number;
  username: string;
  profile?: ReviewAuthorProfile;
}

export interface GameReview {
  id: number;
  game_id: number;
  user_id: number;
  positive: boolean;
  /** Нейтральный отзыв: positive=false, neutral=true (не отрицательный) */
  neutral?: boolean;
  content: string;
  created_at: string;
  author?: ReviewAuthor;
}

export interface ReviewsResponse {
  reviews: GameReview[];
  positive_count: number;
  negative_count: number;
  neutral_count: number;
}

export async function getGameReviews(gameId: number | string): Promise<ReviewsResponse> {
  const res = await api.get(`/reviews/${gameId}`);
  const data = (res.data ?? {}) as Partial<ReviewsResponse>;
  return {
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    positive_count: data.positive_count ?? 0,
    negative_count: data.negative_count ?? 0,
    // старый сервер не знает про нейтральные — считаем их по списку
    neutral_count: data.neutral_count ?? (Array.isArray(data.reviews) ? data.reviews.filter((r) => r.neutral).length : 0),
  };
}

export type ReviewRating = 'positive' | 'neutral' | 'negative';

export function reviewRating(r: Pick<GameReview, 'positive' | 'neutral'>): ReviewRating {
  return r.neutral ? 'neutral' : r.positive ? 'positive' : 'negative';
}

/** Оставить или обновить свой отзыв (повторная отправка заменяет прежний). */
export async function saveReview(gameId: number | string, rating: ReviewRating, content: string): Promise<void> {
  await api.post('/reviews/', {
    game_id: Number(gameId),
    positive: rating === 'positive',
    neutral: rating === 'neutral',
    content: content.trim(),
  });
}

/** Удалить отзыв (свой; модератор — любой). */
export async function deleteReview(id: number): Promise<void> {
  await api.delete(`/reviews/${id}`);
}
