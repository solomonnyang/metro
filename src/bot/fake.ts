import type { MessageFromUser, TelegramCallbackQuery } from './types.js';

/**
 * Builds a minimal message from a callback query so callback handlers can
 * re-enter the matching command without duplicating its logic.
 */
export const messageFromCallback = (query: TelegramCallbackQuery): MessageFromUser =>
  ({
    message_id: query.message?.message_id ?? 0,
    date: 0,
    chat: { id: query.message?.chat.id ?? query.from.id },
    from: query.from
  }) as MessageFromUser;
