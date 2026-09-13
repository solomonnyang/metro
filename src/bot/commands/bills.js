import UserService from '../../services/userService.js';
import BillService from '../../services/billService.js';
import WalletService from '../../services/walletService.js';
import { formatCurrency, formatDate, getStatusEmoji, escapeMarkdown, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';

export const billsCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const user = await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, 'Please start the bot first with /start');
    }

    const bills = await BillService.getUserPendingBills(user.id);

    if (bills.length === 0) {
      return bot.sendMessage(chatId,
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
    }

    const shown = bills.slice(0, 8);

    let message = '📋 *Your Pending Bills:*\n\n';
    shown.forEach((bill, index) => {
      const status = getStatusEmoji(bill.status);
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

export const viewBillsCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'refresh_bills') {
      const fakeMsg = {
        chat: { id: chatId },
        from: { id: query.from.id }
      };
      await billsCommand(bot, fakeMsg);
      return await bot.answerCallbackQuery(query.id, { text: 'Bills refreshed!' });
    }

    if (data.startsWith('pay_bill_')) {
      const billId = data.replace('pay_bill_', '');
      await bot.answerCallbackQuery(query.id);

      const user = await UserService.getUserByTelegramId(query.from.id);
      const bill = await BillService.getBillById(billId);

      if (!bill || !bill.account || !user || bill.account.userId !== user.id) {
        return bot.sendMessage(chatId, 'That bill could not be found.');
      }
      if (bill.status !== 'pending') {
        return bot.sendMessage(chatId, `This bill is already ${bill.status}.`);
      }

      const balance = await WalletService.getBalance(user.id);
      const enough = balance >= Number(bill.amount);

      return bot.sendMessage(chatId,
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
    }

    if (data.startsWith('confirm_bill_')) {
      const billId = data.replace('confirm_bill_', '');
      await bot.answerCallbackQuery(query.id);

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user) {
        return bot.sendMessage(chatId, 'Please send /start first.');
      }

      const result = await WalletService.debitForBill(user.id, billId);

      if (!result.success) {
        if (result.error === 'Insufficient balance') {
          return bot.sendMessage(chatId,
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
        }
        return bot.sendMessage(chatId, result.error || 'Could not pay this bill.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
      }

      const token = result.bill?.token;
      const tokenText = token
        ? `\n🔌 *Your Electricity Token:*\n\`${token}\`\n\n_Enter this token into your meter to credit your units._\n`
        : '';

      return bot.sendMessage(chatId,
        `✅ *Bill paid from wallet!*\n\n💰 Amount: ${formatCurrency(result.amount)}\n👛 New balance: ${formatCurrency(result.balance)}${tokenText}`,
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
