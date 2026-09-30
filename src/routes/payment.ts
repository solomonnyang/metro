import express, { type Request, type Response, type Router } from 'express';
import PaymentService from '../services/paymentService.js';
import PaystackService from '../services/paystack.js';
import { generateReceiptPdf, type ReceiptPayment } from '../services/receiptService.js';
import { sendMessage, sendDocument } from '../bot/index.js';
import { User } from '../models/index.js';
import { formatCurrency, escapeMarkdown } from '../utils/helpers.js';

const router: Router = express.Router();

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'];

    if (PaystackService.isWebhookSecretConfigured()) {
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      if (typeof signature !== 'string' || !PaystackService.verifyWebhookSignatureRaw(rawBody, signature)) {
        console.warn('⚠️ Rejected webhook with invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const { event, data } = req.body as { event: string; data: { reference: string } };

    console.log('📡 Webhook received:', event);

    const result = await PaymentService.handleWebhook(event, data);

    if (event === 'charge.success' && result.success && !('alreadyProcessed' in result && result.alreadyProcessed)) {
      const payment = 'payment' in result ? result.payment : undefined;
      if (payment && payment.user) {
        const isTopup = payment.purpose === 'wallet_topup' || !payment.billId;

        if (isTopup) {
          const balance = 'walletBalance' in result ? result.walletBalance : undefined;
          await sendMessage(payment.user.telegramId,
            `✅ *Wallet topped up!*\n\n💰 Amount: ${formatCurrency(payment.amount)}${balance != null ? `\n👛 New balance: ${formatCurrency(balance)}` : ''}\n\nYou can now pay your bills from your wallet.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '👛 Wallet', callback_data: 'menu_wallet' }],
                  [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
                ]
              }
            });
        } else {
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
              inline_keyboard: [
                [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
              ]
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
        }
      }
    }

    if (event === 'charge.failed') {
      const failed = await PaymentService.getPaymentByReference(data.reference);
      if (failed?.user) {
        await sendMessage(failed.user.telegramId,
          `❌ *Payment failed*\n\n💰 Amount: ${formatCurrency(failed.amount)}\n🔖 Ref: \`${escapeMarkdown(failed.paystackReference || 'N/A')}\`\n\nNo charge was made. You can try again from the menu.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔁 Try Again', callback_data: 'menu_pay' }],
                [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.get('/payment/status/:reference', async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference;
    if (!reference) {
      res.status(400).json({ error: 'Missing payment reference' });
      return;
    }

    const payment = await PaymentService.getPaymentByReference(reference);

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json({
      success: true,
      payment: {
        reference: payment.paystackReference,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

router.post('/payment/initialize', async (req: Request, res: Response) => {
  try {
    const { userId, billId } = req.body as { userId: string; billId: string };

    const user = await User.findByPk(userId);
    if (!user || !user.email) {
      res.status(400).json({ error: 'User email not found' });
      return;
    }

    const result = await PaymentService.initiatePayment(userId, billId, user.email);

    res.json({
      success: true,
      authorizationUrl: result.authorizationUrl,
      reference: result.payment.paystackReference
    });
  } catch (error) {
    console.error('Payment init error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

export default router;
