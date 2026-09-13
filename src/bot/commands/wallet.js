import UserService from '../../services/userService.js';
import WalletService from '../../services/walletService.js';
import PaymentService from '../../services/paymentService.js';
import { formatCurrency, formatDateTime, escapeMarkdown, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';
import { setConversation, getConversation, clearConversation } from '../state.js';
import { emailGate } from './payment.js';

const MIN_TOPUP = 500;
const MAX_TOPUP = 1000000;
const PRESETS = [500, 1000, 2000, 5000];

const walletKeyboard = () => ({
  inline_keyboard: [
    [{ text: '➕ Top Up', callback_data: 'wallet_topup' }],
    [{ text: '📜 History', callback_data: 'wallet_history' }],
    [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
  ]
});

const topupKeyboard = () => {
  const keyboard = createInlineKeyboard(
    PRESETS.map((amount) => ({
      text: `₦${amount.toLocaleString('en-NG')}`,
      data: `wallet_preset_${amount}`
    })),
    2
  );
  keyboard.push(buttonRow([{ text: '✍️ Enter Amount', data: 'wallet_custom' }]));
  keyboard.push(buttonRow([{ text: '⬅️ Back to Wallet', data: 'wallet_menu' }]));
  return keyboard;
};

const sendWallet = async (bot, chatId, userId) => {
  const balance = await WalletService.getBalance(userId);
  return bot.sendMessage(chatId,
    `👛 *Your Wallet*\n\n💰 Balance: ${formatCurrency(balance)}`,
    { parse_mode: 'Markdown', reply_markup: walletKeyboard() });
};

const startTopup = async (bot, chatId, telegramId, amount) => {
  const user = await UserService.getUserByTelegramId(telegramId);
  if (!user) {
    return bot.sendMessage(chatId, 'Please send /start first.');
  }
  if (!user.email) {
    return emailGate(bot, chatId);
  }

  const value = Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;
  if (!(value >= MIN_TOPUP) || value > MAX_TOPUP) {
    return bot.sendMessage(chatId,
      `❌ Enter an amount between ${formatCurrency(MIN_TOPUP)} and ${formatCurrency(MAX_TOPUP)}.`);
  }

  const { payment, authorizationUrl } = await PaymentService.initiateTopup(user.id, user.email, value);

  return bot.sendMessage(chatId,
    `💳 *Wallet top-up*\n\n💰 Amount: ${formatCurrency(value)}\n🔖 Ref: \`${escapeMarkdown(payment.paystackReference)}\`\n\nTap *Pay Now* to fund your wallet, then tap *Check Status*.`,
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

export const walletCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await UserService.getUserByTelegramId(msg.from.id);
    if (!user) {
      return bot.sendMessage(chatId, 'Please start the bot first with /start');
    }
    await sendWallet(bot, chatId, user.id);
  } catch (error) {
    console.error('Wallet command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};

export const walletCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    const user = await UserService.getUserByTelegramId(query.from.id);
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: 'Send /start first' });
      return;
    }

    if (data === 'wallet_menu') {
      await bot.answerCallbackQuery(query.id);
      return sendWallet(bot, chatId, user.id);
    }

    if (data === 'wallet_topup') {
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId,
        `➕ *Top Up Wallet*\n\nChoose an amount (minimum ${formatCurrency(MIN_TOPUP)}):`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: topupKeyboard() } });
    }

    if (data === 'wallet_custom') {
      await bot.answerCallbackQuery(query.id);
      await setConversation(chatId, { type: 'wallet', step: 'amount', userId: user.id });
      return bot.sendMessage(chatId,
        `✍️ *Enter amount*\n\nSend the amount you want to add (${formatCurrency(MIN_TOPUP)} – ${formatCurrency(MAX_TOPUP)}).\n\nSend /cancel to stop.`,
        { parse_mode: 'Markdown' });
    }

    if (data.startsWith('wallet_preset_') || data.startsWith('wallet_confirm_')) {
      const raw = data.replace('wallet_preset_', '').replace('wallet_confirm_', '');
      await bot.answerCallbackQuery(query.id);
      return startTopup(bot, chatId, query.from.id, parseFloat(raw));
    }

    if (data === 'wallet_history') {
      await bot.answerCallbackQuery(query.id);

      const transactions = await WalletService.listTransactions(user.id, 10);
      const buttons = [
        [{ text: '➕ Top Up', callback_data: 'wallet_topup' }],
        [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
      ];

      if (transactions.length === 0) {
        return bot.sendMessage(chatId, '📭 No wallet activity yet.', {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      let message = '📜 *Wallet History:*\n\n';
      transactions.forEach((txn, index) => {
        const sign = txn.direction === 'credit' ? '➕' : '➖';
        message += `${index + 1}. ${sign} ${formatCurrency(txn.amount)} — ${escapeMarkdown(String(txn.type).replace(/_/g, ' '))}\n`;
        message += `   • ${formatDateTime(txn.createdAt)}\n`;
        message += `   • Balance: ${formatCurrency(txn.balanceAfter)}\n\n`;
      });

      return bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    }
  } catch (error) {
    console.error('Wallet callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};

export const handleWalletInput = async (bot, msg) => {
  const chatId = msg.chat.id;
  const conv = await getConversation(chatId);
  if (!conv || conv.type !== 'wallet' || conv.step !== 'amount') return;

  const amount = parseFloat((msg.text || '').replace(/[₦,NGN\s]/gi, ''));

  if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    return bot.sendMessage(chatId,
      `❌ Enter a valid amount between ${formatCurrency(MIN_TOPUP)} and ${formatCurrency(MAX_TOPUP)}.\n\nExample: \`1000\``,
      { parse_mode: 'Markdown' });
  }

  await clearConversation(chatId);

  return bot.sendMessage(chatId,
    `🧾 *Confirm top-up*\n\n💰 Amount: ${formatCurrency(amount)}\n\nYou'll be taken to Paystack to complete the payment.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Confirm & Pay', callback_data: `wallet_confirm_${amount}` }],
          [{ text: '❌ Cancel', callback_data: 'wallet_menu' }]
        ]
      }
    });
};
