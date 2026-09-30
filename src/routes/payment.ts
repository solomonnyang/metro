import express, { type Request, type Response, type Router } from 'express';
import PaymentService, { type VerifyPaymentResult } from '../services/paymentService.js';
import PaystackService from '../services/paystack.js';
import { notifyPaymentSuccess } from '../services/paymentNotification.js';
import { sendMessage } from '../bot/index.js';
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

    if (event === 'charge.success' && result.success) {
      const alreadyProcessed = 'alreadyProcessed' in result && result.alreadyProcessed;
      if (!alreadyProcessed && 'payment' in result) {
        await notifyPaymentSuccess(result);
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

    // A missed Paystack webhook would otherwise leave a captured payment stuck
    // as pending/failed forever, so reconcile against Paystack before reporting.
    let result: VerifyPaymentResult | null = null;
    try {
      result = await PaymentService.verifyPayment(reference);
    } catch (error) {
      // Paystack unreachable: fall back to the local row instead of a 500.
      console.warn('Status reconcile deferred:', error instanceof Error ? error.message : error);
    }

    if (result?.success) {
      const alreadyProcessed = 'alreadyProcessed' in result && result.alreadyProcessed;
      if (!alreadyProcessed) {
        try {
          await notifyPaymentSuccess(result);
        } catch (notifyError) {
          console.error('Reconcile notification failed:', notifyError);
        }
      }

      const payment = result.payment;
      res.json({
        success: true,
        reconciled: !alreadyProcessed,
        payment: {
          reference: payment.paystackReference,
          amount: payment.amount,
          status: payment.status,
          paidAt: payment.paidAt
        }
      });
      return;
    }

    const payment = await PaymentService.getPaymentByReference(reference);

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json({
      success: true,
      reconciled: false,
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
