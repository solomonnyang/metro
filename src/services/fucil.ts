import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.FUCIL_API_BASE_URL || 'https://www.fdlng.xyz/agency/api/v1';

/** Nominal amount sent on validation lookups; Fucil rejects a lookup without one. */
const METER_VALIDATION_AMOUNT = 100;

const fucilApi = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
});

fucilApi.interceptors.request.use((config) => {
  const apiKey = process.env.FUCIL_API_KEY;
  if (!apiKey) {
    throw new FucilError('FUCIL_API_KEY is not set');
  }
  config.headers.Authorization = `Bearer ${apiKey}`;
  return config;
});

/** The four sandbox behaviours the agent profile accepts per request. */
export type FucilSandboxScenario = 'success' | 'pending' | 'failed' | 'lookup_fail';

export type FucilDisco = {
  code: string;
  name?: string | null;
  meterType?: string | null;
  paymentPlan?: string | null;
};

export type FucilLookupResult = {
  /** Opaque handle Fucil issues for the meter; must be passed back to /vend. */
  reference: string;
  disco: string | null;
  meter: string | null;
  customerName: string | null;
  customerAddress: string | null;
  meterType: string | null;
  amount: number | null;
  /** Postpaid only: the outstanding balance the disco reports. */
  outstanding: number | null;
  billReference: string | null;
  dueDate: string | null;
  raw: Record<string, unknown>;
};

export type FucilVendResult = {
  status: 'completed' | 'pending' | 'failed';
  reference: string | null;
  token: string | null;
  amount: number | null;
  units: number | null;
  message: string | null;
  raw: Record<string, unknown>;
};

export class FucilError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'FucilError';
    this.status = status;
  }
}

const statusOf = (error: unknown): number | null =>
  axios.isAxiosError(error) ? error.response?.status ?? null : null;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Fucil reports errors as `{ success: false, error: { code, message } }`.
 * Other shapes are tolerated so a gateway error still surfaces something useful.
 */
const apiMessageOf = (error: unknown): string | null => {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data as Record<string, unknown> | string | undefined;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (!data || typeof data !== 'object') return null;

  const nested = data.error;
  if (nested && typeof nested === 'object') {
    const message = (nested as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }

  for (const key of ['message', 'error', 'detail', 'reason']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Unwraps Fucil's `{ success, data, meta }` envelope. Returns the body
 * unchanged when it is flat, so error shapes still parse.
 */
const unwrap = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  const inner = record.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return record;
};

/** Reads the first non-empty string from a list of candidate keys. */
const pickString = (source: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
};

const pickNumber = (source: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];

class FucilService {
  static isConfigured(): boolean {
    return Boolean(process.env.FUCIL_API_KEY);
  }

  static isSandbox(): boolean {
    return (process.env.FUCIL_SANDBOX || 'true').toLowerCase() !== 'false';
  }

  /** `sandbox_scenario` is only sent when sandbox mode is on. */
  private static sandboxParams(scenario?: FucilSandboxScenario | null): Record<string, unknown> {
    if (!this.isSandbox()) return {};
    return scenario ? { sandbox_scenario: scenario } : {};
  }

  static async health(): Promise<boolean> {
    try {
      const response = await fucilApi.get('/health');
      return response.status === 200;
    } catch (error) {
      throw new FucilError(`Fucil health check failed: ${messageOf(error)}`, statusOf(error));
    }
  }

  static async getWalletBalance(): Promise<number> {
    try {
      const response = await fucilApi.get('/wallet/balance');
      return pickNumber(unwrap(response.data), ['balance', 'wallet_balance', 'amount']) ?? 0;
    } catch (error) {
      throw new FucilError(`Fucil wallet balance failed: ${apiMessageOf(error) || messageOf(error)}`, statusOf(error));
    }
  }

  /**
   * Discos enabled for this agent. Fucil returns one row per disco/meter-type
   * pair (`{ disco, meter_type, payment_plan, label }`).
   */
  static async listDiscos(): Promise<FucilDisco[]> {
    try {
      const response = await fucilApi.get('/discos');
      const body = response.data as Record<string, unknown>;
      const list = Array.isArray(body) ? body : asArray(unwrap(body).discos);

      return list
        .map((entry) => {
          const code = pickString(entry, ['disco', 'code', 'id']);
          if (!code) return null;
          return {
            code,
            name: pickString(entry, ['label', 'name', 'title']),
            meterType: pickString(entry, ['meter_type', 'meterType']),
            paymentPlan: pickString(entry, ['payment_plan', 'paymentPlan'])
          } as FucilDisco;
        })
        .filter((entry): entry is FucilDisco => entry !== null);
    } catch (error) {
      throw new FucilError(`Fucil disco list failed: ${apiMessageOf(error) || messageOf(error)}`, statusOf(error));
    }
  }

  /**
   * Checks that a meter exists at the given disco and returns the account
   * behind it. Fucil requires an `amount` on every lookup, so this sends the
   * smallest useful value purely to satisfy validation.
   */
  static async validateMeter(
    params: { disco: string; meterType: 'Prepaid' | 'Postpaid'; meter: string },
    scenario?: FucilSandboxScenario | null
  ): Promise<FucilLookupResult> {
    return await this.lookup(
      {
        disco: params.disco,
        meterType: params.meterType,
        meter: params.meter,
        amount: METER_VALIDATION_AMOUNT
      },
      scenario
    );
  }

  static async lookup(
    params: {
      disco: string;
      meterType: 'Prepaid' | 'Postpaid';
      meter: string;
      amount?: number | string;
      customerPhone?: string | null;
      customerEmail?: string | null;
    },
    scenario?: FucilSandboxScenario | null
  ): Promise<FucilLookupResult> {
    try {
      const response = await fucilApi.post('/lookup', {
        disco: params.disco,
        meter_type: params.meterType,
        meter: params.meter,
        amount: params.amount === undefined ? undefined : Number(params.amount),
        customer_phone: params.customerPhone || undefined,
        customer_email: params.customerEmail || undefined,
        ...this.sandboxParams(scenario)
      });

      const body = unwrap(response.data);
      const reference = pickString(body, ['reference', 'lookup_reference', 'vend_reference', 'ref']);

      if (!reference) {
        throw new FucilError('Fucil lookup returned no reference', response.status);
      }

      const customer = (body.customer ?? body) as Record<string, unknown>;

      return {
        reference,
        disco: pickString(body, ['disco', 'disco_code']),
        meter:
          pickString(body, ['meter', 'meter_number', 'meterNumber', 'meter_account']) ??
          pickString(customer, ['meterNumber', 'meter_number', 'meterAccount', 'accountNumber']),
        customerName: pickString(customer, [
          'accountName', 'account_name', 'customerName', 'customer_name', 'name'
        ]),
        customerAddress: pickString(customer, [
          'customerAddress', 'customer_address', 'address'
        ]),
        meterType: pickString(body, ['meter_type', 'meterType', 'type']),
        amount: pickNumber(body, ['amount', 'current_bill', 'outstanding', 'bill_amount', 'currentBill']),
        outstanding: pickNumber(customer, ['billedamount', 'billed_amount', 'outstanding']),
        billReference: pickString(body, ['bill_reference', 'billReference', 'bill_ref']),
        dueDate: pickString(body, ['due_date', 'dueDate', 'payment_date']),
        raw: body
      };
    } catch (error) {
      if (error instanceof FucilError) throw error;
      throw new FucilError(`Fucil lookup failed: ${apiMessageOf(error) || messageOf(error)}`, statusOf(error));
    }
  }

  static async vend(
    params: {
      reference: string;
      amount: number | string;
      customerPaymentMethod?: string;
      customerPhone?: string | null;
      customerEmail?: string | null;
    },
    scenario?: FucilSandboxScenario | null
  ): Promise<FucilVendResult> {
    try {
      const response = await fucilApi.post('/vend', {
        reference: params.reference,
        amount: Number(params.amount),
        customer_payment_method: params.customerPaymentMethod || 'cash',
        customer_phone: params.customerPhone || undefined,
        customer_email: params.customerEmail || undefined,
        ...this.sandboxParams(scenario)
      });

      return this.parseVendBody(response.data, response.status);
    } catch (error) {
      if (error instanceof FucilError) throw error;
      // HTTP 202 is a success signal, not an error, so it must not land here.
      throw new FucilError(`Fucil vend failed: ${apiMessageOf(error) || messageOf(error)}`, statusOf(error));
    }
  }

  /** 200 => completed, 202 => pending, anything else is a failure. */
  static async pollVend(
    reference: string,
    scenario?: FucilSandboxScenario | null
  ): Promise<FucilVendResult> {
    try {
      const response = await fucilApi.post('/vend/poll', {
        reference,
        ...this.sandboxParams(scenario)
      });
      return this.parseVendBody(response.data, response.status);
    } catch (error) {
      const status = statusOf(error);

      if (status === 202) {
        const body = axios.isAxiosError(error) ? (error.response?.data as Record<string, unknown>) : {};
        return { status: 'pending', reference, token: null, amount: null, units: null, message: null, raw: unwrap(body) };
      }

      if (error instanceof FucilError) throw error;
      throw new FucilError(`Fucil vend poll failed: ${apiMessageOf(error) || messageOf(error)}`, status);
    }
  }

  static async getOrder(reference: string): Promise<Record<string, unknown>> {
    try {
      const response = await fucilApi.get(`/orders/${encodeURIComponent(reference)}`);
      return unwrap(response.data);
    } catch (error) {
      throw new FucilError(`Fucil order fetch failed: ${apiMessageOf(error) || messageOf(error)}`, statusOf(error));
    }
  }

  static async getReceipt(reference: string): Promise<Record<string, unknown>> {
    try {
      const response = await fucilApi.get(`/receipts/${encodeURIComponent(reference)}`);
      return unwrap(response.data);
    } catch (error) {
      throw new FucilError(`Fucil receipt fetch failed: ${apiMessageOf(error) || messageOf(error)}`, statusOf(error));
    }
  }

  private static parseVendBody(body: unknown, httpStatus: number): FucilVendResult {
    const parsed = unwrap(body);
    const message = pickString(parsed, ['message', 'status_message', 'reason', 'error']);
    const declared = (pickString(parsed, ['vend_status', 'status', 'state']) || '').toLowerCase();

    let status: FucilVendResult['status'];
    if (declared === 'completed' || declared === 'success' || declared === 'successful') {
      status = 'completed';
    } else if (declared === 'pending' || declared === 'processing' || declared === 'in_progress') {
      status = 'pending';
    } else if (declared === 'failed' || declared === 'failure' || declared === 'error') {
      status = 'failed';
    } else {
      // No explicit status: fall back to the HTTP code.
      status = httpStatus === 202 ? 'pending' : 'completed';
    }

    const token = pickString(parsed, ['token', 'meter_token', 'electricity_token', 'token_text']);
    const units = pickNumber(parsed, ['units', 'unit', 'kwh', 'energy']);

    if (status === 'pending' && token) {
      status = 'completed';
    }

    return {
      status,
      reference: pickString(parsed, ['reference', 'vend_reference', 'order_reference', 'ref']),
      token,
      amount: pickNumber(parsed, ['amount', 'vend_amount', 'total']),
      units,
      message,
      raw: parsed
    };
  }

  /**
   * Verifies `X-Fucil-Signature` = `sha256=` + HMAC-SHA256 over
   * `{timestamp}.{raw_json_body}` keyed by the profile's webhook secret.
   */
  static verifyWebhookSignatureRaw(
    rawPayload: string | Buffer,
    signature: string,
    timestamp: string | number | undefined
  ): boolean {
    const secret = process.env.FUCIL_WEBHOOK_SECRET;
    if (!secret) return false;

    const expected =
      'sha256=' +
      crypto
        .createHmac('sha256', secret)
        .update(`${timestamp ?? ''}.${rawPayload.toString()}`)
        .digest('hex');

    return safeCompare(expected, signature);
  }

  /** Rejects stale signatures so a captured payload cannot be replayed later. */
  static isTimestampFresh(timestamp: string | number | undefined, toleranceSeconds = 300): boolean {
    if (!timestamp) return false;

    const numeric = Number(timestamp);
    const seconds = Number.isFinite(numeric) && numeric > 0
      ? numeric
      : Math.floor(new Date(timestamp).getTime() / 1000);

    if (!Number.isFinite(seconds) || seconds <= 0) return false;

    return Math.abs(Math.floor(Date.now() / 1000) - seconds) <= toleranceSeconds;
  }

  static isWebhookSecretConfigured(): boolean {
    return Boolean(process.env.FUCIL_WEBHOOK_SECRET);
  }
}

export default FucilService;
