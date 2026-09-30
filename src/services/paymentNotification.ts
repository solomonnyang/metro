import { sendMessage, sendDocument } from '../bot/index.js';
import { generateReceiptPdf, type ReceiptPayment } from './receiptService.js';
import { formatCurrency } from '../utils/helpers.js';
import type { VerifyPaymentResult } from './paymentService.js';

type SuccessfulPaymentResult = Extract<VerifyPaymentResult, { success: true }>;

/**
 * Tells the customer that a payment landed: a wallet-topup confirmation, or a
 * bill-payment receipt (with the token when one was issued).
 *
 * Shared by the Paystack webhook and the payment-status reconciler so a payment
 * recovered after a missed webhook still notifies the customer.
 */
export const notifyPaymentSuccess = async (result: SuccessfulPaymentResult): Promise<void> => {
  const payment = result.payment;
  if (!payment.user) return;

  const isTopup = payment.purpose === 'wallet_topup' || !payment.billId;

  if (isTopup) {
    const balance = 'walletBalance' in result ? result.walletBalance : undefined;
    await sendMessage(
      payment.user.telegramId,
      `✅ *Wallet topped up!*\n\n💰 Amount: ${formatCurrency(payment.amount)}${balance != null ? `\n👛 New balance: ${formatCurrency(balance)}` : ''}\n\nYou can now pay your bills from your wallet.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👛 Wallet', callback_data: 'menu_wallet' }],
            [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    return;
  }

  const token = payment.bill?.token;
  const tokenText = token
    ? `\n🔌 *Your Electricity Token:*\n\`${token}\`\n\n_Enter this token into your meter to credit your units._`
    : '';

  const message = `
✅ *Payment Successful!*

💰 Amount: ${payment.amount} ${payment.currency}
📋 Bill: \`${payment.bill?.billReference || 'N/A'}\`
${tokenText}
Your bill has been generated and paid. Thank you!
  `;

  await sendMessage(payment.user.telegramId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]]
    }
  });

  try {
    const receiptPdf = await generateReceiptPdf(payment as ReceiptPayment);
    await sendDocument(payment.user.telegramId, receiptPdf, {
      filename: `receipt-${payment.paystackReference}.pdf`,
      contentType: 'application/pdf',
      caption: `🧾 Receipt ${payment.paystackReference}`
    });
  } catch (pdfError) {
    console.error('Receipt generation failed:', pdfError);
  }
};
