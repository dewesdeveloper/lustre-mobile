/** Модерация контента — удаление чужих комментариев, обсуждений, изображений и сообществ:
 *  отдельная роль moderator, а также менеджеры и администраторы (как на сервере). */
export function canModerate(role?: string | null): boolean {
  return role === 'moderator' || role === 'manager' || role === 'admin';
}
