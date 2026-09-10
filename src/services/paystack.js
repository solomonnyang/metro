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

class PaystackService {
  static async initializeTransaction(email, amount, metadata = {}) {
    try {
      const returnLink = `https://t.me/${process.env.BOT_USERNAME}`;
      const response = await paystackApi.post('/transaction/initialize', {
        email,
        amount: Math.round(amount * 100),
        currency: 'NGN',
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
    try {
      const response = await paystackApi.get(`/transaction/verify/${reference}`);
      return response.data;
    } catch (error) {
      throw new Error(`Paystack verification failed: ${error.message}`);
    }
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

  static verifyWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    return hash === signature;
  }

  static verifyWebhookSignatureRaw(rawPayload, signature) {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(rawPayload)
      .digest('hex');
    return hash === signature;
  }

  static isWebhookSecretConfigured() {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    return !!secret && !secret.startsWith('set_from_paystack_dashboard');
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
