import UserService from '../../services/userService.js';
import { sendMainMenu } from '../mainMenu.js';
import { addAccount } from '../addAccount.js';

export const startCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramUser = msg.from;

  try {
    const user = await UserService.findOrCreateUser(telegramUser);
    const accounts = await UserService.getUserAccounts(user.id);

    if (accounts.length === 0) {
      const intro = `
⚡ *Welcome!*

To get started, let's link your electricity meter.
      `;
      await bot.sendMessage(chatId, intro, { parse_mode: 'Markdown' });
      return addAccount(bot, msg);
    }

    const welcomeMessage = `
⚡ *Welcome back!*

How can I help you today?
    `;

    await sendMainMenu(bot, chatId, welcomeMessage, user.id);
  } catch (error) {
    console.error('Start command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};

export const helpCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  const helpMessage = `
📖 *Help*

Use the menu buttons to:
• 📋 View your bills
• 💳 Pay a bill via Paystack
• 🏠 Manage your meter accounts
• 📊 See payment history
• 👤 Update your profile

Commands: /start - Main menu

Contact support if you need help.
    `;

  await sendMainMenu(bot, chatId, helpMessage);
};