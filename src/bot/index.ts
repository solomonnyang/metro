import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { startCommand, helpCommand } from './commands/start.js';
import { billsCommand, viewBillsCallback } from './commands/bills.js';
import { accountsCommand, accountsCallback } from './commands/accounts.js';
import { payCommand, paymentCallback, handlePayInput } from './commands/payment.js';
import { historyCommand, statsCommand } from './commands/history.js';
import { profileCommand, profileCallback, handleProfileInput } from './commands/profile.js';
import { walletCommand, walletCallback, handleWalletInput } from './commands/wallet.js';
import { showMainMenu, sendMainMenu } from './mainMenu.js';
import { addAccount, handleInput, handleCallback } from './addAccount.js';
import { vendStatusCallback } from './vendStatus.js';
import { getConversation, hasConversation, clearConversation } from './state.js';
import { messageFromCallback } from './fake.js';
import type { ChatId, TelegramCallbackQuery, TelegramMessage } from './types.js';
import UserService from '../services/userService.js';
import FucilService from '../services/fucil.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled rejection (bot keeps running):', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught exception (bot keeps running):', error.message);
});

let bot: TelegramBot | undefined;

export const initBot = (): TelegramBot => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  const useWebhook = process.env.TELEGRAM_WEBHOOK === 'true';

  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: !useWebhook
  });

  if (useWebhook) {
    const webhookUrl = `${process.env.APP_URL}/api/telegram-webhook`;
    bot.setWebHook(webhookUrl)
      .then(() => console.log(`Telegram webhook set to ${webhookUrl}`))
      .catch((error: unknown) => console.error('Failed to set Telegram webhook:', error instanceof Error ? error.message : error));
  } else {
    console.log('Telegram bot polling enabled');
  }

  let restartScheduled = false;

  const scheduleRestart = (reason: string) => {
    if (restartScheduled) return;
    restartScheduled = true;

    setTimeout(async () => {
      restartScheduled = false;
      try {
        if (bot?.isPolling()) await bot.stopPolling();
        await bot?.startPolling();
        console.log('Telegram polling restarted');
      } catch (retryError) {
        console.error('Polling restart failed:', retryError instanceof Error ? retryError.message : retryError);
        scheduleRestart('restart failed');
      }
    }, 15000);
  };

  /**
   * Connection failures reach us as an AggregateError holding one error per
   * resolved address (this host has no working IPv6 route to Telegram, so
   * ENETUNREACH on v6 and ETIMEDOUT on v4 arrive together). The transient
   * check therefore has to inspect the nested `errors`, not just the
   * top-level code and message.
   */
  const isTransientPollingError = (error: unknown): boolean => {
    const err = error as (Error & { code?: string; errors?: Array<Error & { code?: string }> }) | undefined;
    const parts = [
      err?.code || '',
      err?.message || '',
      ...(err?.errors || []).map((e) => `${e?.code || ''} ${e?.message || ''}`)
    ].join(' ');

    return /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|ENETDOWN|EPIPE|AggregateError|fetch failed/i.test(parts);
  };

  bot.on('polling_error', (error: Error & { code?: string }) => {
    if (!isTransientPollingError(error)) {
      console.error('Non-transient polling error:', error?.message || error);
      return;
    }

    console.warn('Transient polling error, will restart polling:', error?.message || error);
    scheduleRestart('polling_error');
  });

  // node-telegram-bot-api emits 'error' when it cannot recover from a polling
  // failure. An EventEmitter with no 'error' listener throws on emit, which
  // takes the whole process down with no stack trace, so this must be handled.
  bot.on('error', (error: Error & { code?: string }) => {
    console.error('Telegram bot error:', error?.message || error);

    if (isTransientPollingError(error)) {
      console.warn('Retrying polling after bot error');
      scheduleRestart('bot error');
    }
  });

  registerCommands();
  registerCallbacks();

  return bot;
};

const registerCommands = (): void => {
  if (!bot) return;

  bot.onText(/\/start|\/menu/, (msg) => { void startCommand(bot!, msg); });
  bot.onText(/\/help/, (msg) => { void helpCommand(bot!, msg); });
  bot.onText(/\/bills/, (msg) => { void billsCommand(bot!, msg); });
  bot.onText(/\/pay/, (msg) => { void payCommand(bot!, msg); });
  bot.onText(/\/accounts/, (msg) => { void accountsCommand(bot!, msg); });
  bot.onText(/\/addaccount/, (msg) => { void addAccount(bot!, msg); });
  bot.onText(/\/history/, (msg) => { void historyCommand(bot!, msg); });
  bot.onText(/\/stats/, (msg) => { void statsCommand(bot!, msg); });
  bot.onText(/\/profile/, (msg) => { void profileCommand(bot!, msg); });
  bot.onText(/\/wallet/, (msg) => { void walletCommand(bot!, msg); });

  bot.on('message', (msg: TelegramMessage) => {
    void (async () => {
      if (!msg.text) return;
      const chatId = msg.chat.id;

      try {
        if (!(await hasConversation(chatId))) return;

        // Commands are handled by their own onText handlers; we only need to
        // reset/handle the active conversation here.
        if (msg.text.startsWith('/')) {
          if (msg.text === '/cancel') {
            await clearConversation(chatId);
            const user = msg.from ? await UserService.getUserByTelegramId(msg.from.id) : null;
            await sendMainMenu(bot!, chatId, '❌ Cancelled. Back to the main menu.', user?.id);
          } else if (msg.text === '/start') {
            await clearConversation(chatId);
          }
          return;
        }

        const conv = await getConversation(chatId);
        if (!conv) return;

        if (conv.type === 'pay') {
          await handlePayInput(bot!, msg);
        } else if (conv.type === 'profile') {
          await handleProfileInput(bot!, msg);
        } else if (conv.type === 'wallet') {
          await handleWalletInput(bot!, msg);
        } else {
          await handleInput(bot!, msg);
        }
      } catch (error) {
        console.error('Conversation input error:', error);
      }
    })();
  });

  if (FucilService.isConfigured()) {
    FucilService.health()
      .then(() => console.log('⚡ Fucil vending provider reachable'))
      .catch((error: unknown) => console.error('⚠️ Fucil health check failed:', error instanceof Error ? error.message : error));
  } else {
    console.warn('⚠️  FUCIL_API_KEY is not set — purchases cannot be vended.');
  }

  console.log('📝 Commands registered');
};

const registerCallbacks = (): void => {
  if (!bot) return;

  bot.on('callback_query', (query: TelegramCallbackQuery) => {
    void (async () => {
      const data = query.data;

      try {
        if (data === 'menu_bills') {
          await billsCommand(bot!, messageFromCallback(query));
        } else if (data === 'menu_pay') {
          await payCommand(bot!, messageFromCallback(query));
        } else if (data === 'menu_accounts') {
          await accountsCommand(bot!, messageFromCallback(query));
        } else if (data === 'menu_history') {
          await historyCommand(bot!, messageFromCallback(query));
        } else if (data === 'menu_stats') {
          await statsCommand(bot!, messageFromCallback(query));
        } else if (data === 'menu_wallet') {
          await walletCommand(bot!, messageFromCallback(query));
        } else if (data?.startsWith('wallet_')) {
          await walletCallback(bot!, query);
        } else if (data === 'menu_profile') {
          await profileCommand(bot!, messageFromCallback(query));
        } else if (data === 'menu_help') {
          await helpCommand(bot!, messageFromCallback(query));
        } else if (data === 'main_menu') {
          await showMainMenu(bot!, query);
        } else if (data === 'add_account') {
          await addAccount(bot!, messageFromCallback(query));
          await bot!.answerCallbackQuery(query.id);
        } else if (
          data === 'type_prepaid' ||
          data === 'type_postpaid' ||
          data?.startsWith('disco_') ||
          data === 'cancel_add_account' ||
          data === 'save_meter' ||
          data === 'reenter_meter'
        ) {
          await handleCallback(bot!, query);
        } else if (data?.startsWith('check_vend_')) {
          await vendStatusCallback(bot!, query);
        } else if (data?.startsWith('pay_acc_') || data?.startsWith('confirm_pay_') || data === 'cancel_pay' || data?.startsWith('cancel_payment_') || data?.startsWith('check_payment_')) {
          await paymentCallback(bot!, query);
        } else if (data === 'refresh_bills' || data?.startsWith('pay_bill_') || data?.startsWith('confirm_bill_')) {
          await viewBillsCallback(bot!, query);
        } else if (data === 'refresh_accounts' || data?.startsWith('remove_account_')) {
          await accountsCallback(bot!, query);
        } else if (data === 'update_email' || data === 'update_phone') {
          await profileCallback(bot!, query);
        }
      } catch (error) {
        console.error('Callback query error:', error);
        await bot!.answerCallbackQuery(query.id, { text: 'An error occurred' });
      }
    })();
  });

  console.log('🔘 Callback handlers registered');
};

export const getBot = (): TelegramBot | undefined => bot;

export const sendMessage = async (
  chatId: ChatId,
  message: string,
  options: Record<string, unknown> = {}
) => {
  if (!bot) throw new Error('Bot not initialized');
  return await bot.sendMessage(chatId, message, options);
};

export const sendDocument = async (
  chatId: ChatId,
  buffer: Buffer,
  options: Record<string, unknown> = {}
) => {
  if (!bot) throw new Error('Bot not initialized');
  return await bot.sendDocument(chatId, buffer, {}, options);
};
