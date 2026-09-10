import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { startCommand, helpCommand } from './commands/start.js';
import { billsCommand, viewBillsCallback } from './commands/bills.js';
import { accountsCommand, accountsCallback } from './commands/accounts.js';
import { payCommand, paymentCallback, handlePayInput } from './commands/payment.js';
import { historyCommand, statsCommand } from './commands/history.js';
import { profileCommand, profileCallback } from './commands/profile.js';
import { showMainMenu, sendMainMenu } from './mainMenu.js';
import { addAccount, handleInput, handleCallback } from './addAccount.js';
import { getConversation, hasConversation } from './state.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled rejection (bot keeps running):', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught exception (bot keeps running):', error?.message || error);
});

let bot;

export const initBot = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  console.log('🤖 Telegram bot initialized');

  let restartScheduled = false;
  bot.on('polling_error', (error) => {
    const isTransient = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNREFUSED|ECONNRESET|fetch failed/i.test(
      `${error?.code || ''} ${error?.message || ''}`
    );

    if (!isTransient) {
      console.error('Fatal polling error (no auto-restart):', error?.message || error);
      return;
    }

    console.warn('Transient polling error, will restart polling:', error?.message || error);

    if (restartScheduled) return;
    restartScheduled = true;

    setTimeout(async () => {
      restartScheduled = false;
      try {
        if (bot.isPolling()) await bot.stopPolling();
        await bot.startPolling();
        console.log('Telegram polling restarted');
      } catch (retryError) {
        console.error('Polling restart failed:', retryError?.message || retryError);
      }
    }, 15000);
  });

  registerCommands();
  registerCallbacks();

  return bot;
};

const fakeMsg = (query, override = {}) => ({
  chat: { id: query.message.chat.id },
  from: { id: query.from.id },
  ...override
});

const registerCommands = () => {
  bot.onText(/\/start|\/menu/, (msg) => startCommand(bot, msg));
  bot.onText(/\/help/, (msg) => helpCommand(bot, msg));
  bot.onText(/\/bills/, (msg) => billsCommand(bot, msg));
  bot.onText(/\/pay/, (msg) => payCommand(bot, msg));
  bot.onText(/\/accounts/, (msg) => accountsCommand(bot, msg));
  bot.onText(/\/addaccount/, (msg) => addAccount(bot, msg));
  bot.onText(/\/history/, (msg) => historyCommand(bot, msg));
  bot.onText(/\/stats/, (msg) => statsCommand(bot, msg));
  bot.onText(/\/profile/, (msg) => profileCommand(bot, msg));

  bot.on('message', (msg) => {
    if (msg.text && hasConversation(msg.chat.id)) {
      const conv = getConversation(msg.chat.id);
      const handler = conv.type === 'pay' ? handlePayInput : handleInput;
      handler(bot, msg).catch((error) => {
        console.error('Conversation input error:', error);
      });
    }
  });

  console.log('📝 Commands registered');
};

const registerCallbacks = () => {
  bot.on('callback_query', async (query) => {
    const data = query.data;

    try {
      if (data === 'menu_bills') {
        await billsCommand(bot, fakeMsg(query));
      } else if (data === 'menu_pay') {
        await payCommand(bot, fakeMsg(query));
      } else if (data === 'menu_accounts') {
        await accountsCommand(bot, fakeMsg(query));
      } else if (data === 'menu_history') {
        await historyCommand(bot, fakeMsg(query));
      } else if (data === 'menu_profile') {
        await profileCommand(bot, fakeMsg(query));
      } else if (data === 'menu_help') {
        await helpCommand(bot, fakeMsg(query));
      } else if (data === 'main_menu') {
        await showMainMenu(bot, query);
      } else if (data === 'add_account') {
        await addAccount(bot, fakeMsg(query));
        await bot.answerCallbackQuery(query.id);
      } else if (data === 'type_prepaid' || data === 'type_postpaid' || data.startsWith('disco_') || data === 'cancel_add_account') {
        await handleCallback(bot, query);
      } else if (data.startsWith('pay_acc_') || data.startsWith('cancel_payment_')) {
        await paymentCallback(bot, query);
      } else if (data === 'refresh_bills' || data.startsWith('pay_bill_')) {
        await viewBillsCallback(bot, query);
      } else if (data === 'refresh_accounts' || data.startsWith('remove_account_')) {
        await accountsCallback(bot, query);
      } else if (data === 'update_email' || data === 'update_phone') {
        await profileCallback(bot, query);
      }
    } catch (error) {
      console.error('Callback query error:', error);
      await bot.answerCallbackQuery(query.id, { text: 'An error occurred' });
    }
  });

  console.log('🔘 Callback handlers registered');
};

export const getBot = () => bot;

export const sendMessage = async (chatId, message, options = {}) => {
  if (!bot) throw new Error('Bot not initialized');
  return await bot.sendMessage(chatId, message, options);
};

export const sendDocument = async (chatId, buffer, options = {}) => {
  if (!bot) throw new Error('Bot not initialized');
  return await bot.sendDocument(chatId, buffer, {}, options);
};
