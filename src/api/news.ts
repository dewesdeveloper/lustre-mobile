import api from './client';

export interface NewsTag {
  id: number;
  name: string;
  category?: string;
}

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  category: string;
  image_url: string;
  link: string;
  tags?: NewsTag[];
  created_at: string;
  updated_at?: string;
  score: number;
  for_you: boolean;
}

/**
 * Лента новостей. Ошибки пробрасываются — обрабатывайте через apiError().
 * @param category категория из NEWS_CATEGORIES (необязательно, 'all' — вся лента)
 */
export async function getNews(category?: string): Promise<NewsItem[]> {
  const res = await api.get('/news/', {
    params: category && category !== 'all' ? { category } : undefined,
  });
  return Array.isArray(res.data) ? (res.data as NewsItem[]) : [];
}

/**
 * Новость по id. На бэкенде нет GET /news/:id — ищем в общей ленте.
 * null — новость не найдена (удалена или неверный id).
 */
export async function getNewsById(id: number): Promise<NewsItem | null> {
  const items = await getNews();
  return items.find((n) => n.id === id) ?? null;
}
