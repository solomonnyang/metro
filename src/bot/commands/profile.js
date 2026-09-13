import UserService from '../../services/userService.js';
import { createInlineKeyboard, escapeMarkdown, buttonRow } from '../../utils/helpers.js';
import { setConversation, getConversation, clearConversation } from '../state.js';
import { sendMainMenu } from '../mainMenu.js';

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
    if (data === 'update_email' || data === 'update_phone') {
      const user = await UserService.getUserByTelegramId(query.from.id);
      await bot.answerCallbackQuery(query.id);

      if (!user) {
        return bot.sendMessage(chatId, 'Please send /start first.');
      }

      const step = data === 'update_email' ? 'email' : 'phone';
      await setConversation(chatId, { type: 'profile', step, userId: user.id });

      const prompt = step === 'email'
        ? '📧 *Update Email*\n\nSend your email address below.\n\nSend /cancel to stop.'
        : '📱 *Update Phone*\n\nSend your phone number below.\n\nSend /cancel to stop.';

      return bot.sendMessage(chatId, prompt, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Cancel', callback_data: 'main_menu' }]] }
      });
    }
  } catch (error) {
    console.error('Profile callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};

export const handleProfileInput = async (bot, msg) => {
  const chatId = msg.chat.id;
  const conv = await getConversation(chatId);
  if (!conv || conv.type !== 'profile') return;

  const text = (msg.text || '').trim();

  try {
    if (conv.step === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(text)) {
        return bot.sendMessage(chatId, '❌ That doesn\'t look like a valid email. Please send a valid email, or send /cancel.');
      }

      await UserService.updateUserEmail(msg.from.id, text);
      await clearConversation(chatId);

      const user = await UserService.getUserByTelegramId(msg.from.id);
      return sendMainMenu(bot, chatId, `✅ Email updated to *${escapeMarkdown(text)}*.\n\nYou can now make payments.`, user?.id);
    }

    if (conv.step === 'phone') {
      if (text.replace(/\D/g, '').length < 10) {
        return bot.sendMessage(chatId, '❌ That doesn\'t look like a valid phone number. Please try again, or send /cancel.');
      }

      await UserService.updateUserPhone(msg.from.id, text);
      await clearConversation(chatId);

      const user = await UserService.getUserByTelegramId(msg.from.id);
      return sendMainMenu(bot, chatId, `✅ Phone number updated to *${escapeMarkdown(text)}*.`, user?.id);
    }
  } catch (error) {
    console.error('Profile input error:', error);
    await clearConversation(chatId);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};
