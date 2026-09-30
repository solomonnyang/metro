import UserService from '../../services/userService.js';
import BillService from '../../services/billService.js';
import WalletService from '../../services/walletService.js';
import VendService from '../../services/vendService.js';
import { formatCurrency, formatDate, getStatusEmoji, escapeMarkdown, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';
import { messageFromCallback } from '../fake.js';
import type { Bot, TelegramCallbackQuery, TelegramMessage } from '../types.js';

export const billsCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  try {
    const user = telegramId === undefined ? null : await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }

    const bills = await BillService.getUserPendingBills(user.id);

    if (bills.length === 0) {
      await bot.sendMessage(chatId,
        '📭 *No pending bills found.*\n\nYou\'re all caught up! You can top up your meter anytime.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              buttonRow([{ text: '⚡ Buy Electricity', data: 'menu_pay' }]),
              buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }])
            ]
          }
        });
      return;
    }

    const shown = bills.slice(0, 8);

    let message = '📋 *Your Pending Bills:*\n\n';
    shown.forEach((bill, index) => {
      const status = getStatusEmoji(bill.status ?? '');
      message += `${status} *Bill ${index + 1}*\n`;
      message += `• Amount: ${formatCurrency(bill.amount)}\n`;
      message += `• Period: ${escapeMarkdown(bill.period || 'N/A')}\n`;
      message += `• Due Date: ${formatDate(bill.dueDate)}\n`;
      message += `• Reference: \`${escapeMarkdown(bill.billReference)}\`\n\n`;
    });
    if (bills.length > shown.length) {
      message += `_…and ${bills.length - shown.length} more._\n`;
    }

    const buttons = shown.map((bill, index) => ({
      text: `${index + 1}. ${formatCurrency(bill.amount)}`,
      data: `pay_bill_${bill.id}`
    }));

    const keyboard = createInlineKeyboard(buttons, 2);
    keyboard.push(buttonRow([{ text: '🔄 Refresh', data: 'refresh_bills' }]));
    keyboard.push(buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }]));

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('Bills command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred while fetching your bills.');
  }
};

export const viewBillsCallback = async (bot: Bot, query: TelegramCallbackQuery): Promise<void> => {
  const chatId = query.message?.chat.id ?? query.from.id;
  const data = query.data;

  try {
    if (data === 'refresh_bills') {
      await billsCommand(bot, messageFromCallback(query));
      await bot.answerCallbackQuery(query.id, { text: 'Bills refreshed!' });
      return;
    }

    if (data?.startsWith('pay_bill_')) {
      const billId = data.replace('pay_bill_', '');
      await bot.answerCallbackQuery(query.id);

      const user = await UserService.getUserByTelegramId(query.from.id);
      const bill = await BillService.getBillById(billId);

      if (!bill || !bill.account || !user || bill.account.userId !== user.id) {
        await bot.sendMessage(chatId, 'That bill could not be found.');
        return;
      }
      if (bill.status !== 'pending') {
        await bot.sendMessage(chatId, `This bill is already ${bill.status}.`);
        return;
      }

      const balance = await WalletService.getBalance(user.id);
      const enough = balance >= Number(bill.amount);

      await bot.sendMessage(chatId,
        `🧾 *Pay this bill from your wallet*\n\n🔌 Meter: \`${bill.account.meterNumber}\`\n💰 Amount: ${formatCurrency(bill.amount)}\n📅 Period: ${escapeMarkdown(bill.period || 'N/A')}\n⏰ Due: ${formatDate(bill.dueDate)}\n\n👛 Wallet balance: ${formatCurrency(balance)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: enough
              ? [
                  [{ text: '✅ Pay from Wallet', callback_data: `confirm_bill_${bill.id}` }],
                  [{ text: '❌ Cancel', callback_data: 'refresh_bills' }]
                ]
              : [
                  [{ text: '➕ Top Up Wallet', callback_data: 'wallet_topup' }],
                  [{ text: '❌ Cancel', callback_data: 'refresh_bills' }]
                ]
          }
        });
      return;
    }

    if (data?.startsWith('confirm_bill_')) {
      const billId = data.replace('confirm_bill_', '');
      await bot.answerCallbackQuery(query.id);

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user) {
        await bot.sendMessage(chatId, 'Please send /start first.');
        return;
      }

      const bill = await BillService.getBillById(billId);
      if (!bill || !bill.account || bill.account.userId !== user.id) {
        await bot.sendMessage(chatId, 'That bill could not be found.');
        return;
      }
      if (bill.status !== 'pending') {
        await bot.sendMessage(chatId, `This bill is already ${bill.status}.`);
        return;
      }

      const result = await WalletService.debitForBill(user.id, billId);

      if (!result.success) {
        if (result.error === 'Insufficient balance' && 'shortfall' in result) {
          await bot.sendMessage(chatId,
            `❌ *Insufficient balance*\n\nThis bill is ${formatCurrency(result.amount)} but your wallet has ${formatCurrency(result.balance)}.\n\nTop up at least ${formatCurrency(result.shortfall)} to continue.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '➕ Top Up Wallet', callback_data: 'wallet_topup' }],
                  [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
                ]
              }
            });
          return;
        }
        await bot.sendMessage(chatId, result.error || 'Could not pay this bill.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
        return;
      }

      const vendResult = await VendService.initiateVend(billId);

      if (!vendResult.success) {
        await bot.sendMessage(chatId,
          `❌ *Could not complete the purchase*\n\n${escapeMarkdown(vendResult.error)}\n\nYour ${formatCurrency(result.amount)} has been refunded to your wallet.`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
          });
        return;
      }

      const resolved = await vendResult.vend.reload();

      // Postpaid settles without a token; only a pending vend needs a status button.
      if (!resolved?.token && resolved?.status === 'completed') {
        await bot.sendMessage(chatId,
          `✅ *Bill paid from your wallet!*\n\n💰 Amount: ${formatCurrency(result.amount)}\n👛 New balance: ${formatCurrency(result.balance)}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📋 My Bills', callback_data: 'menu_bills' }],
                [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
              ]
            }
          });
        return;
      }

      const token = resolved?.token;

      if (!token) {
        await bot.sendMessage(chatId,
          `✅ *Bill paid from your wallet!*\n\n💰 Amount: ${formatCurrency(result.amount)}\n👛 New balance: ${formatCurrency(result.balance)}\n\n⏳ Your token is still being generated. We'll send it here as soon as it's ready.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Check Status', callback_data: `check_vend_${billId}` }],
                [{ text: '📋 My Bills', callback_data: 'menu_bills' }],
                [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
              ]
            }
          });
        return;
      }

      await bot.sendMessage(chatId,
        `⚡ *Your Electricity Token*\n\n🔌 Meter: \`${bill.account.meterNumber}\`\n💰 Paid: ${formatCurrency(result.amount)}\n\n\`${token}\`\n\n_Enter this token into your meter to credit your units._`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 My Bills', callback_data: 'menu_bills' }],
              [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
            ]
          }
        });
    }
  } catch (error) {
    console.error('Bill callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};
