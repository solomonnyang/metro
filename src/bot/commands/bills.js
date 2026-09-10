import UserService from '../../services/userService.js';
import PaymentService from '../../services/paymentService.js';
import BillService from '../../services/billService.js';
import { formatCurrency, formatDate, getStatusEmoji, createInlineKeyboard, buttonRow } from '../../utils/helpers.js';

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
      const keyboard = [
        buttonRow([{ text: '⚡ Pay Now', data: 'menu_pay' }]),
        buttonRow([{ text: '⬅️ Back to Menu', data: 'main_menu' }])
      ];

      return bot.sendMessage(chatId,
        '📭 *No pending bills found.*\n\nYou\'re all caught up! ' +
        'Use Pay Bill to top up your meter anytime.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
    }

    let message = '📋 *Your Pending Bills:*\n\n';

    const buttons = bills.slice(0, 8).map((bill, index) => ({
      text: `${index + 1}. ${formatCurrency(bill.amount)} - ${bill.period || 'N/A'}`,
      data: `pay_bill_${bill.id}`
    }));

    bills.forEach((bill, index) => {
      const status = getStatusEmoji(bill.status);
      message += `${status} *Bill ${index + 1}*\n`;
      message += `• Amount: ${formatCurrency(bill.amount)}\n`;
      message += `• Period: ${bill.period || 'N/A'}\n`;
      message += `• Due Date: ${formatDate(bill.dueDate)}\n`;
      message += `• Reference: ${bill.billReference}\n\n`;
    });

    const keyboard = createInlineKeyboard(buttons, 2);
    keyboard.push(buttonRow([{ text: '🔄 Refresh Bills', data: 'refresh_bills' }]));
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
      await bot.answerCallbackQuery(query.id, { text: 'Processing payment...' });

      const user = await UserService.getUserByTelegramId(query.from.id);
      if (!user || !user.email) {
        return bot.sendMessage(chatId, 
          '⚠️ Please set your email first using /profile before making payments.'
        );
      }

      const { payment, authorizationUrl } = await PaymentService.initiatePayment(
        user.id, 
        billId, 
        user.email
      );

      const message = `
💳 *Payment Initiated*

Amount: ${formatCurrency(payment.amount)}
Reference: ${payment.paystackReference}

Click the button below to complete payment:
      `;

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Pay Now', url: authorizationUrl }],
            [{ text: '❌ Cancel', callback_data: `cancel_payment_${payment.id}` }]
          ]
        }
      });
    }
  } catch (error) {
    console.error('Bill callback error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
  }
};
