import express, { type Request, type Response, type Router } from 'express';
import FucilService from '../services/fucil.js';
import VendService from '../services/vendService.js';

const router: Router = express.Router();

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-fucil-signature'];
    const timestamp = (req.headers['x-fucil-timestamp'] as string | undefined)
      || (req.headers['x-timestamp'] as string | undefined);

    if (FucilService.isWebhookSecretConfigured()) {
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      if (typeof signature !== 'string' || !FucilService.verifyWebhookSignatureRaw(rawBody, signature, timestamp)) {
        console.warn('⚠️ Rejected Fucil webhook with invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
      if (!FucilService.isTimestampFresh(timestamp)) {
        console.warn('⚠️ Rejected Fucil webhook with stale timestamp');
        res.status(401).json({ error: 'Stale timestamp' });
        return;
      }
    }

    const body = req.body as Record<string, unknown>;
    const event = (body.event || body.type || '').toString().toLowerCase();
    const data = (body.data ?? body) as Record<string, unknown>;

    const reference = (data.reference || data.vend_reference || data.order_reference || data.lookup_reference || '').toString();
    if (!reference) {
      res.status(400).json({ error: 'Missing vend reference' });
      return;
    }

    const statusRaw = (data.vend_status || data.status || event).toString().toLowerCase();
    let status: 'completed' | 'failed' | 'pending';
    if (statusRaw.includes('complete') || statusRaw === 'success' || statusRaw === 'successful') {
      status = 'completed';
    } else if (statusRaw.includes('fail') || statusRaw === 'error') {
      status = 'failed';
    } else {
      status = 'pending';
    }

    const token = (data.token || data.meter_token || data.electricity_token || null) as string | null;
    const units = (data.units || data.kwh || data.energy || null) as string | number | null;
    const message = (data.message || data.reason || null) as string | null;

    const vend = await VendService.resolveFromFucil(reference, status, data, { token, units, message });

    if (vend && status === 'completed') {
      console.log(`✅ Fucil vend completed (bill ${vend.billId})`);
    }

    res.status(200).json({ success: true, vendId: vend?.id });
  } catch (error) {
    console.error('Fucil webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
