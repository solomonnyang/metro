import UserService from '../services/userService.js';
import VendService from '../services/vendService.js';
import { formatCurrency, escapeMarkdown } from '../utils/helpers.js';
import type { Bot, TelegramCallbackQuery } from './types.js';

/**
 * On-demand status for a vend that Fucil reported as pending. Polls Fucil
 * once and reports where the purchase stands. Used as a fallback when the
 * `vend.completed` / `vend.failed` webhook has not arrived yet.
 */
export const vendStatusCallback = async (bot: Bot, query: TelegramCallbackQuery): Promise<void> => {
  const chatId = query.message?.chat.id ?? query.from.id;
  const billId = query.data?.replace('check_vend_', '') ?? '';

  const user = await UserService.getUserByTelegramId(query.from.id);
  if (!user) {
    await bot.answerCallbackQuery(query.id, { text: 'Please send /start first' });
    return;
  }

  const vend = await VendService.getVendByBill(billId);
  if (!vend || vend.userId !== user.id) {
    await bot.answerCallbackQuery(query.id, { text: 'Purchase not found' });
    await bot.sendMessage(chatId, 'That purchase could not be found.');
    return;
  }

  await bot.answerCallbackQuery(query.id, { text: 'Checking with the provider…' });

  const polled = await VendService.pollPending(vend.id);
  const meterNumber = polled?.account?.meterNumber ?? vend.account?.meterNumber ?? 'N/A';
  const amount = formatCurrency(polled?.amount ?? vend.amount ?? 0);

  if (polled?.status === 'completed') {
    if (!polled.token) {
      // Postpaid settles without a token.
      await bot.sendMessage(chatId,
        `✅ *Purchase complete*\n\n🔌 Meter: \`${meterNumber}\`\n💰 Paid: ${amount}`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
        });
      return;
    }

    await bot.sendMessage(chatId,
      `⚡ *Your Electricity Token*\n\n🔌 Meter: \`${meterNumber}\`\n💰 Paid: ${amount}\n\n\`${polled.token}\`\n\n_Enter this token into your meter to credit your units._`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
      });
    return;
  }

  if (polled?.status === 'failed') {
    const refunded = polled.refunded
      ? `\n\nYour ${amount} has been refunded to your wallet.`
      : '\n\nPlease contact support for a refund.';

    await bot.sendMessage(chatId,
      `❌ *Purchase could not be completed*\n\n${escapeMarkdown(polled.failureReason ?? 'The provider reported a failure.')}${refunded}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]] }
      });
    return;
  }

  await bot.sendMessage(chatId,
    '⏳ *Still processing*\n\nThe electricity provider is still working on your token. We\'ll send it here as soon as it\'s ready.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Check Again', callback_data: `check_vend_${billId}` }],
          [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
};
