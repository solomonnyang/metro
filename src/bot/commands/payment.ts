import UserService from '../../services/userService.js';
import PaymentService from '../../services/paymentService.js';
import BillService from '../../services/billService.js';
import WalletService from '../../services/walletService.js';
import VendService from '../../services/vendService.js';
import { formatCurrency, escapeMarkdown, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';
import { setConversation, getConversation, clearConversation } from '../state.js';
import { sendMainMenu } from '../mainMenu.js';
import type { VerifiedPayment, VerifyPaymentResult } from '../../services/paymentService.js';
import type { Account, Bill } from '../../models/index.js';
import type { Bot, ChatId, TelegramCallbackQuery, TelegramMessage } from '../types.js';

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;

type MaybePayment = VerifiedPayment | null | undefined;

const isTopup = (payment: MaybePayment): boolean =>
  payment?.purpose === 'wallet_topup' || !payment?.billId;

const topupText = (payment: MaybePayment, balance?: number): string =>
  `✅ *Wallet topped up!*\n\n💰 Amount: ${formatCurrency(payment?.amount ?? 0)}${balance != null ? `\n👛 New balance: ${formatCurrency(balance)}` : ''}`;

export const emailGate = async (bot: Bot, chatId: ChatId): Promise<void> => {
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

const successText = (payment: MaybePayment): string => {
  const token = payment?.bill?.token;
  const tokenText = token
    ? `\n🔌 *Your Electricity Token:*\n\`${token}\`\n\n_Enter this token into your meter to credit your units._\n`
    : '';
  return `✅ *Payment Successful!*\n\n💰 Amount: ${formatCurrency(payment?.amount ?? 0)}\n🔖 Ref: \`${escapeMarkdown(payment?.paystackReference || 'N/A')}\`\n${tokenText}\nThank you!`;
};

export const sendPaymentLink = async (
  bot: Bot,
  chatId: ChatId,
  {
    account,
    bill,
    payment,
    authorizationUrl
  }: { account?: Account | null; bill: Bill; payment: VerifiedPayment; authorizationUrl: string }
): Promise<void> => {
  const meterLine = account?.meterNumber ? `🔌 Meter: \`${account.meterNumber}\`\n` : '';
  await bot.sendMessage(chatId,
    `💳 *Payment initiated*\n\n${meterLine}💰 Amount: ${formatCurrency(bill.amount)}\n🔖 Ref: \`${escapeMarkdown(payment.paystackReference || 'N/A')}\`\n\nTap *Pay Now* to complete payment, then *Check Status*.`,
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

export const payCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  try {
    const user = telegramId === undefined ? null : await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }

    if (!user.email) {
      await bot.sendMessage(chatId,
        '⚠️ Please set your email first using /profile before making payments.');
      return;
    }

    const accounts = await UserService.getUserAccounts(user.id);

    if (accounts.length === 0) {
      const message = '📭 *You don\'t have any meters yet.*\n\nAdd your meter to start paying for electricity.';
      const keyboard = [
        buttonRow([{ text: '➕ Add My Meter', data: 'add_account' }]),
        buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }])
      ];
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
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

export const handlePayInput = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const conv = await getConversation(chatId);
  if (!conv || conv.type !== 'pay' || conv.step !== 'amount') return;

  const amount = parseFloat((msg.text || '').replace(/[₦,NGN\s]/gi, ''));
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    await bot.sendMessage(chatId,
      `❌ Please enter a valid amount between ${formatCurrency(MIN_AMOUNT)} and ${formatCurrency(MAX_AMOUNT)}.\n\nExample: \`5000\` or \`5,000\``,
      { parse_mode: 'Markdown' });
    return;
  }

  const accountId = typeof conv.accountId === 'string' ? conv.accountId : undefined;
  const account = accountId ? await UserService.getAccountById(accountId) : null;
  await clearConversation(chatId);

  if (!account) {
    await bot.sendMessage(chatId, 'That meter could not be found. Please try again.');
    return;
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

export const paymentCallback = async (bot: Bot, query: TelegramCallbackQuery): Promise<void> => {
  const chatId = query.message?.chat.id ?? query.from.id;
  const data = query.data;

  try {
    if (data?.startsWith('pay_acc_')) {
      const accountId = data.replace('pay_acc_', '');
      await bot.answerCallbackQuery(query.id);

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user) {
        await bot.sendMessage(chatId, 'Please send /start first.');
        return;
      }

      const account = await UserService.getAccountById(accountId);
      if (!account || account.userId !== user.id) {
        await bot.sendMessage(chatId, 'That meter could not be found.');
        return;
      }

      await setConversation(chatId, { type: 'pay', step: 'amount', accountId, userId: user.id });

      await bot.sendMessage(chatId,
        `🎛️ *How much do you want to pay?*\n\nSend the amount in Naira, e.g. \`5000\`.\n\nMin ${formatCurrency(MIN_AMOUNT)}  •  Max ${formatCurrency(MAX_AMOUNT)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_pay' }]] }
        });
      return;
    }

    if (data === 'cancel_pay') {
      await clearConversation(chatId);
      await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
      const user = await UserService.getUserByTelegramId(query.from.id);
      await sendMainMenu(bot, chatId, '❌ Cancelled. Back to the main menu.', user?.id);
      return;
    }

    if (data?.startsWith('confirm_pay_')) {
      await bot.answerCallbackQuery(query.id);

      const rest = data.replace('confirm_pay_', '');
      const sep = rest.lastIndexOf('_');
      const accountId = rest.slice(0, sep);
      const amount = parseFloat(rest.slice(sep + 1));

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user) {
        await bot.sendMessage(chatId, 'Please send /start first.');
        return;
      }
      if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
        await bot.sendMessage(chatId, 'That amount is no longer valid. Please start again.');
        return;
      }

      const account = await UserService.getAccountById(accountId);
      if (!account || account.userId !== user.id) {
        await bot.sendMessage(chatId, 'That meter could not be found.');
        return;
      }

      const balance = await WalletService.getBalance(user.id);
      if (balance < amount) {
        const shortfall = Math.round((amount - balance + Number.EPSILON) * 100) / 100;
        await bot.sendMessage(chatId,
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
        return;
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const period = new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

      const bill = await BillService.generateBill(accountId, amount, dueDate, period);
        const result = await WalletService.debitForBill(user.id, bill.id, { reference: `VEND-${Date.now()}-${bill.id.slice(0, 8)}` });

      if (!result.success) {
        await bill.update({ status: 'cancelled' }).catch(() => {});
        await bot.sendMessage(chatId, result.error || 'Could not complete the payment.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
        return;
      }

      await bot.sendMessage(chatId,
        `✅ *Payment received!*\n\n🔌 Meter: \`${account.meterNumber}\`\n💰 Amount: ${formatCurrency(result.amount)}\n👛 New balance: ${formatCurrency(result.balance)}\n\n⏳ Sending your token to the meter…`,
        { parse_mode: 'Markdown' });

      const vend = await VendService.initiateVend(bill.id);

      if (!vend.success) {
        await bot.sendMessage(chatId,
          `❌ *Could not complete the purchase*\n\n${escapeMarkdown(vend.error)}\n\nYour ${formatCurrency(result.amount)} has been refunded to your wallet.`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
          });
        return;
      }

      const resolved = await vend.vend.reload();
      const token = resolved?.token;

      if (!token) {
        await bot.sendMessage(chatId,
          `⏳ *Your token is still being generated*\n\nThe electricity provider is processing your purchase. We'll send your token here as soon as it's ready.\n\n🔖 Ref: \`${escapeMarkdown(bill.billReference)}\``,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Check Status', callback_data: `check_vend_${bill.id}` }],
                [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
              ]
            }
          });
        return;
      }

      await bot.sendMessage(chatId,
        `⚡ *Your Electricity Token*\n\n🔌 Meter: \`${account.meterNumber}\`\n💰 Paid: ${formatCurrency(result.amount)}\n\n\`${token}\`\n\n_Enter this token into your meter to credit your units._`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ Buy Electricity', callback_data: 'menu_pay' }],
              [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
            ]
          }
        });
      return;
    }

    if (data?.startsWith('cancel_payment_')) {
      const paymentId = data.replace('cancel_payment_', '');
      const user = await UserService.getUserByTelegramId(query.from.id);
      const result = await PaymentService.cancelPayment(paymentId, user?.id);

      await bot.answerCallbackQuery(query.id, { text: result.success ? 'Payment cancelled' : 'Could not cancel' });

      if (!result.success) {
        await bot.sendMessage(chatId, result.error || 'Could not cancel this payment.');
        return;
      }

      await bot.sendMessage(chatId,
        '❌ *Payment cancelled.*\n\nNothing was charged. You can start a new payment anytime.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
      return;
    }

    if (data?.startsWith('check_payment_')) {
      const paymentId = data.replace('check_payment_', '');
      await bot.answerCallbackQuery(query.id, { text: 'Checking…' });

      const payment = await PaymentService.getPaymentById(paymentId);
      if (!payment) {
        await bot.sendMessage(chatId, 'Payment not found.');
        return;
      }
      if (payment.status === 'success') {
        if (isTopup(payment)) {
          const balance = await WalletService.getBalance(payment.userId);
          await bot.sendMessage(chatId, topupText(payment, balance), { parse_mode: 'Markdown' });
          return;
        }
        await bot.sendMessage(chatId, successText(payment), { parse_mode: 'Markdown' });
        return;
      }
      if (payment.metadata?.cancelled) {
        await bot.sendMessage(chatId, 'This payment was cancelled. No charge was made.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
        return;
      }
      if (payment.status === 'failed') {
        await bot.sendMessage(chatId,
          '❌ *This payment failed.*\n\nNo charge was made. You can start a new payment from the menu.',
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
          });
        return;
      }

      let verified: VerifyPaymentResult = { success: false, error: 'Verification failed' };
      if (payment.paystackReference) {
        try {
          verified = await PaymentService.verifyPayment(payment.paystackReference);
        } catch (verifyError) {
          console.error('Verify on check failed:', verifyError instanceof Error ? verifyError.message : verifyError);
        }
      }

      if (verified.success) {
        if (isTopup(verified.payment)) {
          await bot.sendMessage(chatId, topupText(verified.payment, verified.walletBalance), { parse_mode: 'Markdown' });
          return;
        }
        await bot.sendMessage(chatId, successText(verified.payment), { parse_mode: 'Markdown' });
        return;
      }

      await bot.sendMessage(chatId,
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