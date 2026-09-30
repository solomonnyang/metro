import UserService from '../../services/userService.js';
import { createInlineKeyboard, escapeMarkdown, buttonRow, type InlineButton } from '../../utils/helpers.js';
import { messageFromCallback } from '../fake.js';
import type { Bot, TelegramCallbackQuery, TelegramMessage } from '../types.js';

export const accountsCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  try {
    if (telegramId === undefined) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }

    const user = await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }

    const accounts = await UserService.getUserAccounts(user.id);

    if (accounts.length === 0) {
      await bot.sendMessage(chatId,
        '📭 No meter accounts found.\n\nTap ➕ Add My Meter on the main menu, or send /addaccount.'
      );
      return;
    }

    let message = '🏠 *Your Meter Accounts:*\n\n';

    accounts.forEach((account, index) => {
      message += `*${index + 1}. ${escapeMarkdown(account.accountName)}*\n`;
      message += `• Meter Number: \`${account.meterNumber}\`\n`;
      message += `• Type: ${account.accountType.toUpperCase()}\n`;
      message += `• Distribution: ${escapeMarkdown(account.distributionCompany)}\n`;
      if (account.address) {
        message += `• Address: ${account.address}\n`;
      }
      message += '\n';
    });

    const buttons: InlineButton[] = [
      { text: '➕ Add New Account', data: 'add_account' },
      { text: '🔄 Refresh', data: 'refresh_accounts' }
    ];

    accounts.forEach((account) => {
      buttons.push({
        text: `❌ Remove ${account.accountName}`,
        data: `remove_account_${account.id}`
      });
    });

    const keyboard = createInlineKeyboard(buttons, 2);
    keyboard.push(buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }]));

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('Accounts command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred while fetching your accounts.');
  }
};

export const accountsCallback = async (bot: Bot, query: TelegramCallbackQuery): Promise<void> => {
  const chatId = query.message?.chat.id ?? query.from.id;
  const data = query.data;

  try {
    if (data === 'refresh_accounts') {
      await accountsCommand(bot, messageFromCallback(query));
      await bot.answerCallbackQuery(query.id, { text: 'Accounts refreshed!' });
      return;
    }

    if (data?.startsWith('remove_account_')) {
      const accountId = data.replace('remove_account_', '');
      const user = await UserService.getUserByTelegramId(query.from.id);

      if (user) {
        await UserService.deactivateAccount(accountId, user.id);
        await bot.answerCallbackQuery(query.id, { text: 'Account removed!' });

        await accountsCommand(bot, messageFromCallback(query));
      }
    }
  } catch (error) {
    console.error('Accounts callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};
