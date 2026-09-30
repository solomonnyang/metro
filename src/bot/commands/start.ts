import UserService from '../../services/userService.js';
import { sendMainMenu } from '../mainMenu.js';
import { addAccount } from '../addAccount.js';
import type { Bot, TelegramMessage } from '../types.js';

export const startCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const telegramUser = msg.from;

  if (!telegramUser) {
    await bot.sendMessage(chatId, 'Sorry, I could not identify your account. Please try again.');
    return;
  }

  try {
    const user = await UserService.findOrCreateUser(telegramUser);
    const accounts = await UserService.getUserAccounts(user.id);

    if (accounts.length === 0) {
      const intro = `
⚡ *Welcome!*

To get started, let's link your electricity meter.
      `;
      await bot.sendMessage(chatId, intro, { parse_mode: 'Markdown' });
      return await addAccount(bot, msg);
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

export const helpCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;

  const helpMessage = `
📖 *Help*

Tap a button below or use a command:

📋 /bills — View and pay pending bills
⚡ /pay — Buy electricity (top up a meter)
🏠 /accounts — Manage your meters
📊 /history — Payment history
👤 /profile — Update your email or phone
❓ /help — Show this help

💡 Set your email in 👤 Profile before paying — we use it to create the Paystack payment.
    `;

  const user = msg.from ? await UserService.getUserByTelegramId(msg.from.id) : null;
  await sendMainMenu(bot, chatId, helpMessage, user?.id);
};
