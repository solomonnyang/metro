/**
 * Bot-layer aliases over `node-telegram-bot-api`'s definitions.
 *
 * The upstream types are loose in a few places that matter here — `Message.from`
 * is optional and `chat_id` accepts `number | string` — so command handlers
 * narrow once at the top rather than guarding at every use.
 */

import type TelegramBot from 'node-telegram-bot-api';

export type Bot = TelegramBot;
export type ChatId = TelegramBot.ChatId;
export type TelegramMessage = TelegramBot.Message;
export type TelegramCallbackQuery = TelegramBot.CallbackQuery;
export type TelegramUser = TelegramBot.User;
export type TelegramChat = TelegramBot.Chat;

/** `Message.from` is optional upstream, but every handler needs it. */
export type MessageFromUser = TelegramMessage & { from: TelegramUser };

/** `CallbackQuery.message` is optional, but every button handler edits in place. */
export type CallbackWithMessage = TelegramCallbackQuery & { message: TelegramMessage };

export type InlineKeyboardMarkup = {
  inline_keyboard: TelegramBot.InlineKeyboardButton[][];
};
