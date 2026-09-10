import UserService from '../../services/userService.js';
import { createInlineKeyboard, escapeMarkdown, buttonRow } from '../../utils/helpers.js';

export const accountsCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const user = await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, 'Please start the bot first with /start');
    }

    const accounts = await UserService.getUserAccounts(user.id);

    if (accounts.length === 0) {
      return bot.sendMessage(chatId, 
        '📭 No meter accounts found.\n\nTap ➕ Add My Meter on the main menu, or send /addaccount.'
      );
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

    const buttons = [
      { text: '➕ Add New Account', data: 'add_account' },
      { text: '🔄 Refresh', data: 'refresh_accounts' }
    ];

    accounts.forEach(account => {
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

export const accountsCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'refresh_accounts') {
      const fakeMsg = {
        chat: { id: chatId },
        from: { id: query.from.id }
      };
      await accountsCommand(bot, fakeMsg);
      return await bot.answerCallbackQuery(query.id, { text: 'Accounts refreshed!' });
    }

    if (data.startsWith('remove_account_')) {
      const accountId = data.replace('remove_account_', '');
      const user = await UserService.getUserByTelegramId(query.from.id);
      
      if (user) {
        await UserService.deactivateAccount(accountId, user.id);
        await bot.answerCallbackQuery(query.id, { text: 'Account removed!' });
        
        const fakeMsg = {
          chat: { id: chatId },
          from: { id: query.from.id }
        };
        await accountsCommand(bot, fakeMsg);
      }
    }
  } catch (error) {
    console.error('Accounts callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};
