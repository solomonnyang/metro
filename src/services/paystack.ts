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

export type PaystackResponse<T = Record<string, unknown>> = {
  status: boolean;
  message: string;
  data: T;
};

/** `data` payload returned by POST /transaction/initialize. */
export type PaystackInitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
  amount: number;
  [key: string]: unknown;
};

/** `data` payload returned by GET /transaction/verify/:reference. */
export type PaystackVerifyData = {
  reference: string;
  status: string;
  channel?: string | null;
  paid_at?: string | number | Date | null;
  authorization?: {
    card_type?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

/** Error carrying the HTTP status Paystack returned, so callers can branch on 4xx. */
export class PaystackError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'PaystackError';
    this.status = status;
  }
}

/** Axios rejections surface the status on `error.response`, not on the error. */
const statusOf = (error: unknown): number | null => {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }
  return null;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

class PaystackService {
  static async initializeTransaction(
    email: string,
    amount: number | string,
    metadata: Record<string, unknown> = {}
  ): Promise<PaystackResponse<PaystackInitializeData>> {
    try {
      const returnLink = `https://t.me/${process.env.BOT_USERNAME}`;
      const channels = (process.env.PAYSTACK_CHANNELS || 'bank_transfer')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const response = await paystackApi.post<PaystackResponse<PaystackInitializeData>>('/transaction/initialize', {
        email,
        amount: Math.round(Number(amount) * 100),
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
      throw new PaystackError(`Paystack initialization failed: ${messageOf(error)}`, statusOf(error));
    }
  }

  static async verifyTransaction(reference: string): Promise<PaystackResponse<PaystackVerifyData>> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await paystackApi.get<PaystackResponse<PaystackVerifyData>>(
          `/transaction/verify/${reference}`
        );
        return response.data;
      } catch (error) {
        const status = statusOf(error);
        if (status && status < 500 && status !== 429) {
          throw new PaystackError(`Paystack verification failed: ${messageOf(error)}`, status);
        }
        lastError = error;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    throw new PaystackError(`Paystack verification failed: ${messageOf(lastError)}`, statusOf(lastError));
  }

  static async createCustomer(
    email: string,
    firstName: string,
    lastName?: string | null,
    phone?: string | null
  ): Promise<PaystackResponse> {
    try {
      const response = await paystackApi.post('/customer', {
        email,
        first_name: firstName,
        last_name: lastName,
        phone
      });
      return response.data as PaystackResponse;
    } catch (error) {
      throw new PaystackError(`Customer creation failed: ${messageOf(error)}`, statusOf(error));
    }
  }

  static async getCustomer(emailOrCode: string): Promise<PaystackResponse> {
    try {
      const response = await paystackApi.get(`/customer/${emailOrCode}`);
      return response.data as PaystackResponse;
    } catch (error) {
      throw new PaystackError(`Customer fetch failed: ${messageOf(error)}`, statusOf(error));
    }
  }

  static async createPlan(
    name: string,
    amount: number | string,
    interval = 'monthly'
  ): Promise<PaystackResponse> {
    try {
      const response = await paystackApi.post('/plan', {
        name,
        amount: Math.round(Number(amount) * 100),
        interval,
        currency: 'NGN'
      });
      return response.data as PaystackResponse;
    } catch (error) {
      throw new PaystackError(`Plan creation failed: ${messageOf(error)}`, statusOf(error));
    }
  }

  // Paystack signs webhook payloads with your SECRET KEY (HMAC SHA512),
  // not a separate webhook secret.
  static webhookSecret(): string {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  static verifyWebhookSignature(payload: unknown, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.webhookSecret())
      .update(JSON.stringify(payload))
      .digest('hex');
    return safeCompare(hash, signature);
  }

  static verifyWebhookSignatureRaw(rawPayload: string | Buffer, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.webhookSecret())
      .update(rawPayload)
      .digest('hex');
    return safeCompare(hash, signature);
  }

  static isWebhookSecretConfigured(): boolean {
    return this.webhookSecret().startsWith('sk_');
  }

  static async listTransactions(page = 1, perPage = 50): Promise<PaystackResponse> {
    try {
      const response = await paystackApi.get('/transaction', {
        params: { page, perPage }
      });
      return response.data as PaystackResponse;
    } catch (error) {
      throw new PaystackError(`Transaction list failed: ${messageOf(error)}`, statusOf(error));
    }
  }
}

export default PaystackService;
