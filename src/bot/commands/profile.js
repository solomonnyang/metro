import UserService from '../../services/userService.js';
import { createInlineKeyboard, escapeMarkdown, buttonRow } from '../../utils/helpers.js';

export const profileCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const user = await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, 'Please start the bot first with /start');
    }

    const name = escapeMarkdown(`${user.firstName} ${user.lastName || ''}`.trim());
    const username = escapeMarkdown(user.username || 'N/A');

    const message = `
👤 *Your Profile*

• Name: ${name}
• Username: @${username}
• Email: ${escapeMarkdown(user.email || 'Not set')}
• Phone: ${escapeMarkdown(user.phone || 'Not set')}
• Member Since: ${new Date(user.createdAt).toLocaleDateString()}
• Last Active: ${new Date(user.lastInteraction).toLocaleString()}
    `;

    const buttons = [
      { text: '📧 Update Email', data: 'update_email' },
      { text: '📱 Update Phone', data: 'update_phone' }
    ];

    const keyboard = createInlineKeyboard(buttons, 2);
    keyboard.push(buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }]));

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('Profile command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred while fetching your profile.');
  }
};

export const profileCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'update_email') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, 
        '📧 Please enter your new email address:'
      );

      bot.once('message', async (response) => {
        const email = response.text.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
          return bot.sendMessage(chatId, '❌ Invalid email format. Please try again.');
        }

        await UserService.updateUserEmail(query.from.id, email);
        await bot.sendMessage(chatId, `✅ Email updated to: ${email}`);
      });
    }

    if (data === 'update_phone') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, 
        '📱 Please enter your new phone number:'
      );

      bot.once('message', async (response) => {
        const phone = response.text.trim();
        
        if (phone.length < 10) {
          return bot.sendMessage(chatId, '❌ Invalid phone number. Please try again.');
        }

        await UserService.updateUserPhone(query.from.id, phone);
        await bot.sendMessage(chatId, `✅ Phone number updated to: ${phone}`);
      });
    }
  } catch (error) {
    console.error('Profile callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};
