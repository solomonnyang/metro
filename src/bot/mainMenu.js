import { createInlineKeyboard } from '../utils/helpers.js';
import UserService from '../services/userService.js';

export const getMainMenuKeyboard = async (userId) => {
  let accounts = [];
  if (userId) {
    accounts = await UserService.getUserAccounts(userId);
  }

  let buttons;
  if (accounts.length === 0) {
    buttons = [
      { text: '➕ Add My Meter', data: 'add_account' },
      { text: '❓ Help', data: 'menu_help' }
    ];
  } else {
    buttons = [
      { text: '📋 My Bills', data: 'menu_bills' },
      { text: '💳 Pay Bill', data: 'menu_pay' },
      { text: '🏠 Accounts', data: 'menu_accounts' },
      { text: '📊 History', data: 'menu_history' },
      { text: '👤 Profile', data: 'menu_profile' },
      { text: '❓ Help', data: 'menu_help' }
    ];
  }

  return { inline_keyboard: createInlineKeyboard(buttons, 2) };
};

export const sendMainMenu = async (bot, chatId, message, userId) => {
  await bot.sendMessage(chatId, message || '🏠 *Main Menu*\n\nChoose an option below:', {
    parse_mode: 'Markdown',
    reply_markup: await getMainMenuKeyboard(userId)
  });
};

export const showMainMenu = async (bot, query, message) => {
  const user = await UserService.getUserByTelegramId(query.from.id);
  const userId = user?.id;

  await bot.editMessageText(message || '🏠 *Main Menu*\n\nChoose an option below:', {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'Markdown',
    reply_markup: await getMainMenuKeyboard(userId)
  });
  await bot.answerCallbackQuery(query.id);
};