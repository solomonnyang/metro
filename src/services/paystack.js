import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const paystackApi = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

const safeCompare = (a, b) => {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

class PaystackService {
  static async initializeTransaction(email, amount, metadata = {}) {
    try {
      const returnLink = `https://t.me/${process.env.BOT_USERNAME}`;
      const channels = (process.env.PAYSTACK_CHANNELS || 'bank_transfer')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const response = await paystackApi.post('/transaction/initialize', {
        email,
        amount: Math.round(amount * 100),
        currency: 'NGN',
        channels,
        callback_url: returnLink,
        metadata: {
          ...metadata,
          cancel_action: returnLink
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Paystack initialization failed: ${error.message}`);
    }
  }

  static async verifyTransaction(reference) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await paystackApi.get(`/transaction/verify/${reference}`);
        return response.data;
      } catch (error) {
        const status = error.response?.status || null;
        if (status && status < 500 && status !== 429) {
          const e = new Error(`Paystack verification failed: ${error.message}`);
          e.status = status;
          throw e;
        }
        lastError = error;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    throw new Error(`Paystack verification failed: ${lastError.message}`);
  }

  static async createCustomer(email, firstName, lastName, phone) {
    try {
      const response = await paystackApi.post('/customer', {
        email,
        first_name: firstName,
        last_name: lastName,
        phone
      });
      return response.data;
    } catch (error) {
      throw new Error(`Customer creation failed: ${error.message}`);
    }
  }

  static async getCustomer(emailOrCode) {
    try {
      const response = await paystackApi.get(`/customer/${emailOrCode}`);
      return response.data;
    } catch (error) {
      throw new Error(`Customer fetch failed: ${error.message}`);
    }
  }

  static async createPlan(name, amount, interval = 'monthly') {
    try {
      const response = await paystackApi.post('/plan', {
        name,
        amount: Math.round(amount * 100),
        interval,
        currency: 'NGN'
      });
      return response.data;
    } catch (error) {
      throw new Error(`Plan creation failed: ${error.message}`);
    }
  }

  // Paystack signs webhook payloads with your SECRET KEY (HMAC SHA512),
  // not a separate webhook secret.
  static webhookSecret() {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  static verifyWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha512', this.webhookSecret())
      .update(JSON.stringify(payload))
      .digest('hex');
    return safeCompare(hash, signature);
  }

  static verifyWebhookSignatureRaw(rawPayload, signature) {
    const hash = crypto
      .createHmac('sha512', this.webhookSecret())
      .update(rawPayload)
      .digest('hex');
    return safeCompare(hash, signature);
  }

  static isWebhookSecretConfigured() {
    return this.webhookSecret().startsWith('sk_');
  }

  static async listTransactions(page = 1, perPage = 50) {
    try {
      const response = await paystackApi.get('/transaction', {
        params: { page, perPage }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Transaction list failed: ${error.message}`);
    }
  }
}

export default PaystackService;
