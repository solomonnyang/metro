import UserService from '../../services/userService.js';
import PaymentService from '../../services/paymentService.js';
import BillService from '../../services/billService.js';
import WalletService from '../../services/walletService.js';
import { formatCurrency, escapeMarkdown, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';
import { setConversation, getConversation, clearConversation } from '../state.js';
import { sendMainMenu } from '../mainMenu.js';

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;

const isTopup = (payment) => payment?.purpose === 'wallet_topup' || !payment?.billId;

const topupText = (payment, balance) =>
  `✅ *Wallet topped up!*\n\n💰 Amount: ${formatCurrency(payment.amount)}${balance != null ? `\n👛 New balance: ${formatCurrency(balance)}` : ''}`;

export const emailGate = async (bot, chatId) => {
  await bot.sendMessage(chatId,
    '📧 *Email required*\n\nWe use your email to create the Paystack payment. Please add it to continue.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📧 Add Email', callback_data: 'update_email' }],
          [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
};

const successText = (payment) => {
  const token = payment?.bill?.token;
  const tokenText = token
    ? `\n🔌 *Your Electricity Token:*\n\`${token}\`\n\n_Enter this token into your meter to credit your units._\n`
    : '';
  return `✅ *Payment Successful!*\n\n💰 Amount: ${formatCurrency(payment.amount)}\n🔖 Ref: \`${escapeMarkdown(payment.paystackReference || 'N/A')}\`\n${tokenText}\nThank you!`;
};

export const sendPaymentLink = async (bot, chatId, { account, bill, payment, authorizationUrl }) => {
  const meterLine = account?.meterNumber ? `🔌 Meter: \`${account.meterNumber}\`\n` : '';
  return bot.sendMessage(chatId,
    `💳 *Payment initiated*\n\n${meterLine}💰 Amount: ${formatCurrency(bill.amount)}\n🔖 Ref: \`${escapeMarkdown(payment.paystackReference)}\`\n\nTap *Pay Now* to complete payment, then *Check Status*.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏦 Pay Now', url: authorizationUrl }],
          [{ text: '🔄 Check Status', callback_data: `check_payment_${payment.id}` }],
          [{ text: '❌ Cancel', callback_data: `cancel_payment_${payment.id}` }]
        ]
      }
    });
};

export const payCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const user = await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, 'Please start the bot first with /start');
    }

    if (!user.email) {
      return bot.sendMessage(chatId,
        '⚠️ Please set your email first using /profile before making payments.');
    }

    const accounts = await UserService.getUserAccounts(user.id);

    if (accounts.length === 0) {
      const message = '📭 *You don\'t have any meters yet.*\n\nAdd your meter to start paying for electricity.';
      const keyboard = [
        buttonRow([{ text: '➕ Add My Meter', data: 'add_account' }]),
        buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }])
      ];
      return bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    const message = '⚡ *Buy Electricity*\n\nSelect the meter you want to buy electricity for:';
    const buttons = accounts.map(account => ({
      text: `🔌 ${account.meterNumber} (${account.accountName})`,
      data: `pay_acc_${account.id}`
    }));

    const keyboard = createInlineKeyboard(buttons, 1);
    keyboard.push(buttonRow([{ text: '➕ Add New Meter', data: 'add_account' }]));
    keyboard.push(buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }]));

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    console.error('Pay command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};

export const handlePayInput = async (bot, msg) => {
  const chatId = msg.chat.id;
  const conv = await getConversation(chatId);
  if (!conv || conv.type !== 'pay' || conv.step !== 'amount') return;

  const amount = parseFloat((msg.text || '').replace(/[₦,NGN\s]/gi, ''));
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return bot.sendMessage(chatId,
      `❌ Please enter a valid amount between ${formatCurrency(MIN_AMOUNT)} and ${formatCurrency(MAX_AMOUNT)}.\n\nExample: \`5000\` or \`5,000\``,
      { parse_mode: 'Markdown' });
  }

  const account = await UserService.getAccountById(conv.accountId);
  await clearConversation(chatId);

  if (!account) {
    return bot.sendMessage(chatId, 'That meter could not be found. Please try again.');
  }

  const summary = `🧾 *Confirm your purchase*\n\n🔌 Meter: \`${account.meterNumber}\`\n🏢 ${escapeMarkdown(account.distributionCompany)}\n💰 Amount: ${formatCurrency(amount)}\n\nThe amount will be deducted from your wallet.`;

  await bot.sendMessage(chatId, summary, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Confirm & Pay', callback_data: `confirm_pay_${account.id}_${amount}` }],
        [{ text: '❌ Cancel', callback_data: 'cancel_pay' }]
      ]
    }
  });
};

export const paymentCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data.startsWith('pay_acc_')) {
      const accountId = data.replace('pay_acc_', '');
      await bot.answerCallbackQuery(query.id);

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user) {
        return bot.sendMessage(chatId, 'Please send /start first.');
      }

      const account = await UserService.getAccountById(accountId);
      if (!account || account.userId !== user.id) {
        return bot.sendMessage(chatId, 'That meter could not be found.');
      }

      await setConversation(chatId, { type: 'pay', step: 'amount', accountId, userId: user.id });

      return bot.sendMessage(chatId,
        `🎛️ *How much do you want to pay?*\n\nSend the amount in Naira, e.g. \`5000\`.\n\nMin ${formatCurrency(MIN_AMOUNT)}  •  Max ${formatCurrency(MAX_AMOUNT)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_pay' }]] }
        });
    }

    if (data === 'cancel_pay') {
      await clearConversation(chatId);
      await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
      const user = await UserService.getUserByTelegramId(query.from.id);
      return sendMainMenu(bot, chatId, '❌ Cancelled. Back to the main menu.', user?.id);
    }

    if (data.startsWith('confirm_pay_')) {
      await bot.answerCallbackQuery(query.id);

      const rest = data.replace('confirm_pay_', '');
      const sep = rest.lastIndexOf('_');
      const accountId = rest.slice(0, sep);
      const amount = parseFloat(rest.slice(sep + 1));

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user) {
        return bot.sendMessage(chatId, 'Please send /start first.');
      }
      if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
        return bot.sendMessage(chatId, 'That amount is no longer valid. Please start again.');
      }

      const account = await UserService.getAccountById(accountId);
      if (!account || account.userId !== user.id) {
        return bot.sendMessage(chatId, 'That meter could not be found.');
      }

      const balance = await WalletService.getBalance(user.id);
      if (balance < amount) {
        const shortfall = Math.round((amount - balance + Number.EPSILON) * 100) / 100;
        return bot.sendMessage(chatId,
          `❌ *Insufficient wallet balance*\n\nYou need ${formatCurrency(amount)} but your wallet has ${formatCurrency(balance)}.\n\nTop up at least ${formatCurrency(shortfall)} to continue.`,
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

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const period = new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

      const bill = await BillService.generateBill(accountId, amount, dueDate, period);
      const result = await WalletService.debitForBill(user.id, bill.id);

      if (!result.success) {
        await bill.update({ status: 'cancelled' }).catch(() => {});
        return bot.sendMessage(chatId, result.error || 'Could not complete the payment.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
      }

      const token = result.bill?.token;
      const tokenText = token
        ? `\n🔌 *Your Electricity Token:*\n\`${token}\`\n\n_Enter this token into your meter to credit your units._\n`
        : '';

      return bot.sendMessage(chatId,
        `✅ *Payment successful!*\n\n🔌 Meter: \`${account.meterNumber}\`\n💰 Amount: ${formatCurrency(result.amount)}\n👛 New balance: ${formatCurrency(result.balance)}${tokenText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ Buy Electricity', callback_data: 'menu_pay' }],
              [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
            ]
          }
        });
    }

    if (data.startsWith('cancel_payment_')) {
      const paymentId = data.replace('cancel_payment_', '');
      const user = await UserService.getUserByTelegramId(query.from.id);
      const result = await PaymentService.cancelPayment(paymentId, user?.id);

      await bot.answerCallbackQuery(query.id, { text: result.success ? 'Payment cancelled' : 'Could not cancel' });

      if (!result.success) {
        return bot.sendMessage(chatId, result.error || 'Could not cancel this payment.');
      }

      return bot.sendMessage(chatId,
        '❌ *Payment cancelled.*\n\nNothing was charged. You can start a new payment anytime.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
    }

    if (data.startsWith('check_payment_')) {
      const paymentId = data.replace('check_payment_', '');
      await bot.answerCallbackQuery(query.id, { text: 'Checking…' });

      const payment = await PaymentService.getPaymentById(paymentId);
      if (!payment) {
        return bot.sendMessage(chatId, 'Payment not found.');
      }
      if (payment.status === 'success') {
        if (isTopup(payment)) {
          const balance = await WalletService.getBalance(payment.userId);
          return bot.sendMessage(chatId, topupText(payment, balance), { parse_mode: 'Markdown' });
        }
        return bot.sendMessage(chatId, successText(payment), { parse_mode: 'Markdown' });
      }
      if (payment.metadata?.cancelled) {
        return bot.sendMessage(chatId, 'This payment was cancelled. No charge was made.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
      }
      if (payment.status === 'failed') {
        return bot.sendMessage(chatId,
          '❌ *This payment failed.*\n\nNo charge was made. You can start a new payment from the menu.',
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
          });
      }

      let verified = { success: false };
      try {
        verified = await PaymentService.verifyPayment(payment.paystackReference);
      } catch (verifyError) {
        console.error('Verify on check failed:', verifyError?.message || verifyError);
      }

      if (verified.success) {
        if (isTopup(verified.payment)) {
          return bot.sendMessage(chatId, topupText(verified.payment, verified.walletBalance), { parse_mode: 'Markdown' });
        }
        return bot.sendMessage(chatId, successText(verified.payment), { parse_mode: 'Markdown' });
      }

      return bot.sendMessage(chatId,
        '⏳ *Still waiting for payment confirmation.*\n\nIf you have completed the payment, give it a moment and tap *Check Status* again.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Check Status', callback_data: `check_payment_${paymentId}` }],
              [{ text: '❌ Cancel', callback_data: `cancel_payment_${paymentId}` }],
              [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
            ]
          }
        });
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};