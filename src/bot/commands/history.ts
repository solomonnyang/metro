import UserService from '../../services/userService.js';
import PaymentService from '../../services/paymentService.js';
import BillService from '../../services/billService.js';
import { formatCurrency, formatDateTime, getStatusEmoji, escapeMarkdown } from '../../utils/helpers.js';
import type { Bot, TelegramMessage } from '../types.js';

export const historyCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  try {
    const user = telegramId === undefined ? null : await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }

    const payments = await PaymentService.getPaymentHistory(user.id, 10);

    if (payments.length === 0) {
      await bot.sendMessage(chatId, '📭 No payment history found.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]]
        }
      });
      return;
    }

    let message = '📊 *Your Payment History:*\n\n';

    payments.forEach((payment, index) => {
      const cancelled = payment.metadata?.cancelled;
      const status = cancelled ? '🚫' : getStatusEmoji(payment.status ?? '');
      message += `*${index + 1}. ${status} ${formatCurrency(payment.amount)}*\n`;
      message += `• Date: ${formatDateTime(payment.paidAt || payment.createdAt)}\n`;
      message += `• Reference: \`${escapeMarkdown(payment.paystackReference || 'N/A')}\`\n`;
      if (payment.bill) {
        message += `• Bill Period: ${escapeMarkdown(payment.bill.period || 'N/A')}\n`;
      }
      if (payment.bill?.token && payment.status === 'success') {
        message += `• 🔌 Token: \`${payment.bill.token}\`\n`;
      }
      message += `• Status: ${cancelled ? 'CANCELLED' : (payment.status ?? '').toUpperCase()}\n\n`;
    });

    const totalPaid = payments
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

    message += `\n💰 *Total Paid:* ${formatCurrency(totalPaid)}`;
    message += `\n📈 *Total Transactions:* ${payments.length}`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
  } catch (error) {
    console.error('History command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred while fetching your history.');
  }
};

export const statsCommand = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  try {
    const user = telegramId === undefined ? null : await UserService.getUserByTelegramId(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }

    const stats = await BillService.getBillStats(user.id);
    const userStats = await UserService.getUserStats(user.id);

    const message = `
📈 *Your Statistics*

🏠 *Accounts:* ${userStats.accountCount}

📋 *Bills Overview:*
• Total Bills: ${stats.total}
• Pending: ${stats.pending}
• Paid: ${stats.paid}
• Overdue: ${stats.overdue}

💰 *Amount Summary:*
• Total Amount: ${formatCurrency(stats.totalAmount)}
• Pending: ${formatCurrency(stats.pendingAmount)}
• Paid: ${formatCurrency(stats.paidAmount)}

Keep up with your payments to avoid overdue bills! ⚡
    `;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
  } catch (error) {
    console.error('Stats command error:', error);
    await bot.sendMessage(chatId, 'Sorry, an error occurred while fetching statistics.');
  }
};
