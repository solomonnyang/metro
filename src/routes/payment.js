import express from 'express';
import PaymentService from '../services/paymentService.js';
import PaystackService from '../services/paystack.js';
import { generateReceiptPdf } from '../services/receiptService.js';
import { sendMessage, sendDocument } from '../bot/index.js';
import { User } from '../models/index.js';

const router = express.Router();

router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];

    if (PaystackService.isWebhookSecretConfigured()) {
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      if (!signature || !PaystackService.verifyWebhookSignatureRaw(rawBody, signature)) {
        console.warn('⚠️ Rejected webhook with invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { event, data } = req.body;

    console.log('📡 Webhook received:', event);

    const result = await PaymentService.handleWebhook(event, data);

    if (event === 'charge.success' && result.success && !result.alreadyProcessed) {
      const payment = result.payment;
      if (payment && payment.user) {
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
          const receiptPdf = await generateReceiptPdf(payment);
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

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.get('/payment/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await PaymentService.getPaymentByReference(reference);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
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

router.post('/payment/initialize', async (req, res) => {
  try {
    const { userId, billId } = req.body;

    const user = await User.findByPk(userId);
    if (!user || !user.email) {
      return res.status(400).json({ error: 'User email not found' });
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
