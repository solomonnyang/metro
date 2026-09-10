import UserService from '../../services/userService.js';
import PaymentService from '../../services/paymentService.js';
import BillService from '../../services/billService.js';
import { formatCurrency, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';
import { setConversation, getConversation, clearConversation } from '../state.js';
import { sendMainMenu } from '../mainMenu.js';

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

    let message = '⚡ *Pay for Electricity*\n\nSelect a meter:';
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
  const conv = getConversation(chatId);
  if (!conv || conv.step !== 'amount') return;

  const text = msg.text.trim();
  if (text === '/cancel' || text === '/start') {
    clearConversation(chatId);
    return sendMainMenu(bot, chatId, 'Payment cancelled.', conv.userId);
  }

  const amount = parseFloat(text.replace(/[₦,NGN\s]/gi, ''));
  if (!Number.isFinite(amount) || amount < 100 || amount > 1000000) {
    return bot.sendMessage(chatId,
      '❌ Please enter a valid amount between ₦100 and ₦1,000,000.\n\n' +
      'Example: `5000` or `5,000`', { parse_mode: 'Markdown' });
  }

  clearConversation(chatId);

  try {
    const user = await UserService.getUserByTelegramId(msg.from.id);
    if (!user || !user.email) {
      return bot.sendMessage(chatId, '⚠️ Please set your email using /profile first.');
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const period = new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

    const bill = await BillService.generateBill(
      conv.accountId,
      amount,
      dueDate,
      period
    );

    const { payment, authorizationUrl } = await PaymentService.initiatePayment(
      user.id,
      bill.id,
      user.email
    );

    const account = await UserService.getAccountById(conv.accountId);

    const message = `
💳 *Payment Summary*

🔌 Meter: \`${account?.meterNumber || conv.accountId}\`
📋 Bill Reference: \`${bill.billReference}\`
💰 Amount: ${formatCurrency(bill.amount)}
🔖 Payment Ref: \`${payment.paystackReference}\`

Click below to complete your payment securely via Paystack.
    `;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Pay Now', url: authorizationUrl }],
          [
            { text: '❌ Cancel', callback_data: `cancel_payment_${payment.id}` },
            { text: '⬅️ Back to Menu', callback_data: 'main_menu' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Pay amount error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};

export const paymentCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data.startsWith('pay_acc_')) {
      const accountId = data.replace('pay_acc_', '');
      await bot.answerCallbackQuery(query.id);

      setConversation(chatId, {
        type: 'pay',
        step: 'amount',
        accountId,
        userId: (await UserService.getUserByTelegramId(query.from.id))?.id
      });

      return bot.sendMessage(chatId,
`🎛️ Enter the amount you want to pay (₦)...

_Example:_ \`5000\` for ₦5,000

Min: ₦100  •  Max: ₦1,000,000

Send /cancel to stop.`, { parse_mode: 'Markdown' });
    }

    if (data.startsWith('cancel_payment_')) {
      await bot.answerCallbackQuery(query.id, { text: 'Payment cancelled' });
      await bot.sendMessage(chatId, 'Payment cancelled. You can start a new payment anytime.');
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};