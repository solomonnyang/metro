import { createInlineKeyboard, formatCurrency, type InlineButton } from '../utils/helpers.js';
import UserService from '../services/userService.js';
import WalletService from '../services/walletService.js';
import type { Bot, ChatId, InlineKeyboardMarkup, TelegramCallbackQuery } from './types.js';

export const getMainMenuKeyboard = async (userId?: string): Promise<InlineKeyboardMarkup> => {
  let accounts = [];
  if (userId) {
    accounts = await UserService.getUserAccounts(userId);
  }

  let buttons: InlineButton[];
  if (accounts.length === 0) {
    buttons = [
      { text: '➕ Add My Meter', data: 'add_account' },
      { text: '❓ Help', data: 'menu_help' }
    ];
  } else {
    buttons = [
      { text: '📋 My Bills', data: 'menu_bills' },
      { text: '⚡ Buy Electricity', data: 'menu_pay' },
      { text: '👛 Wallet', data: 'menu_wallet' },
      { text: '🏠 Accounts', data: 'menu_accounts' },
      { text: '📊 History', data: 'menu_history' },
      { text: '📈 Stats', data: 'menu_stats' },
      { text: '👤 Profile', data: 'menu_profile' },
      { text: '❓ Help', data: 'menu_help' }
    ];
  }

  return { inline_keyboard: createInlineKeyboard(buttons, 2) };
};

export const sendMainMenu = async (
  bot: Bot,
  chatId: ChatId,
  message: string | null,
  userId?: string
): Promise<void> => {
  let text = message || '🏠 *Main Menu*\n\nChoose an option below:';
  if (userId) {
    const balance = await WalletService.getBalance(userId);
    text += `\n\n👛 Wallet: ${formatCurrency(balance)}`;
  }
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: await getMainMenuKeyboard(userId)
  });
};

export const showMainMenu = async (
  bot: Bot,
  query: TelegramCallbackQuery,
  message?: string | null
): Promise<void> => {
  const user = await UserService.getUserByTelegramId(query.from.id);
  const userId = user?.id;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;

  if (chatId === undefined || messageId === undefined) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  await bot.editMessageText(message || '🏠 *Main Menu*\n\nChoose an option below:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: await getMainMenuKeyboard(userId)
  });
  await bot.answerCallbackQuery(query.id);
};
