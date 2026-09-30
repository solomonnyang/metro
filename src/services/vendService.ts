import sequelize from '../config/database.js';
import { Bill, Account, Vend, User } from '../models/index.js';
import BillService from './billService.js';
import WalletService from './walletService.js';
import FucilService, { type FucilSandboxScenario } from './fucil.js';
import { toDiscoCode } from '../utils/discos.js';
import type { FucilLookupResult, FucilVendResult } from './fucil.js';

export type VendCompletionOptions = {
  source?: 'webhook' | 'poll' | 'manual' | 'vend';
  receipt?: Record<string, unknown> | null;
};

export type VendInitiationResult =
  | { success: false; error: string; vend?: Vend | null }
  | { success: true; vend: Vend; lookup?: FucilLookupResult | null };

class VendService {
  /** Determines the sandbox scenario to pass to Fucil, falling back to env. */
  private static scenario(
    explicit?: string | null,
    vendScenario?: string | null
  ): FucilSandboxScenario | undefined {
    const value = explicit || vendScenario || process.env.FUCIL_SANDBOX_SCENARIO;
    if (!value) return undefined;

    const normalized = String(value).toLowerCase();
    if (normalized === 'success' || normalized === 'pending' || normalized === 'failed' || normalized === 'lookup_fail') {
      return normalized as FucilSandboxScenario;
    }
    return undefined;
  }

  /** Postpaid meters bypass Fucil vend; they are marked paid without a token. */
  private static isPrepaid(accountType: string | null | undefined): boolean {
    return (accountType || '').toLowerCase() === 'prepaid';
  }

  private static errorOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Drives a purchase through Fucil: lookup, then vend.
   *
   * Each database step commits before the next network call, so a slow Fucil
   * request never holds a row lock and completion handlers can take their own
   * transactions without deadlocking against this one.
   */
  static async initiateVend(
    billId: string,
    options: { sandboxScenario?: string | null } = {}
  ): Promise<VendInitiationResult> {
    type Claimed =
      | { ok: false; error: string; vend?: Vend | null }
      | { ok: true; bill: Bill; account: Account; vend: Vend };

    const claimed: Claimed = await sequelize.transaction(async (t): Promise<Claimed> => {
      // Lock the bill on its own: `FOR UPDATE` cannot span the outer join that
      // an eager-loaded account would introduce.
      const bill = await Bill.findByPk(billId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!bill) return { ok: false, error: 'Bill not found' };

      const account = await Account.findByPk(bill.accountId, { transaction: t });
      if (!account) return { ok: false, error: 'Account not found' };

      if (bill.status !== 'pending') {
        return { ok: false, error: `This bill is already ${bill.status}.` };
      }

      const vend = await Vend.findOne({ where: { billId }, transaction: t });
      if (!vend) {
        return { ok: false, error: 'No vend record exists for this bill. The wallet was not debited.' };
      }
      if (vend.status === 'completed' || vend.status === 'failed') {
        return { ok: false, error: 'This purchase has already been processed.', vend };
      }

      // Claim the vend so a concurrent request cannot start a second one.
      if (vend.status !== 'processing') {
        await vend.update({ status: 'processing' }, { transaction: t });
      }

      return { ok: true, bill, account, vend };
    });

    if (!claimed.ok) {
      return { success: false, error: claimed.error, vend: claimed.vend ?? null };
    }

    const { account, vend } = claimed;
    const scenario = this.scenario(options.sandboxScenario, vend.sandboxScenario);

    // Postpaid: no token to vend, so settle the bill and close the vend.
    if (!this.isPrepaid(account.accountType)) {
      await this.completeVend(vend.id, {
        status: 'completed',
        reference: null,
        token: null,
        amount: Number(vend.amount),
        units: null,
        message: 'Postpaid bill settled',
        raw: {}
      }, { source: 'vend' });
      await vend.reload();
      return { success: true, vend };
    }

    const discoCode = toDiscoCode(account.distributionCompany);
    if (!discoCode) {
      await this.failVend(vend.id, 'This meter belongs to a distribution company we cannot vend for.');
      await vend.reload();
      return { success: false, error: 'Unsupported distribution company for vending.', vend };
    }

    const user = await User.findByPk(account.userId, { attributes: ['id', 'phone', 'email'] });
    if (!user) {
      await this.failVend(vend.id, 'User not found');
      await vend.reload();
      return { success: false, error: 'User not found', vend };
    }

    let lookup: FucilLookupResult;
    try {
      lookup = await FucilService.lookup(
        {
          disco: discoCode,
          meterType: 'Prepaid',
          meter: account.meterNumber,
          amount: Number(vend.amount),
          customerPhone: user.phone,
          customerEmail: user.email
        },
        scenario
      );
    } catch (error) {
      const message = this.errorOf(error);
      await this.failVend(vend.id, message);
      await vend.reload();
      return { success: false, error: message, vend };
    }

    await vend.update({ fucilLookupReference: lookup.reference, fucilReference: lookup.reference });

    let vendResponse: FucilVendResult;
    try {
      vendResponse = await FucilService.vend(
        {
          reference: lookup.reference,
          amount: Number(vend.amount),
          customerPhone: user.phone,
          customerEmail: user.email
        },
        scenario
      );
    } catch (error) {
      const message = this.errorOf(error);
      await this.failVend(vend.id, message);
      await vend.reload();
      return { success: false, error: message, vend };
    }

    if (vendResponse.status === 'pending') {
      await vend.update({
        status: 'pending',
        fucilReference: vendResponse.reference || lookup.reference
      });
      return { success: true, vend, lookup };
    }

    if (vendResponse.status === 'failed') {
      const reason = vendResponse.message || 'Fucil vend failed';
      await this.failVend(vend.id, reason);
      await vend.reload();
      return { success: false, error: reason, vend };
    }

    await this.completeVend(vend.id, vendResponse, { source: 'vend' });
    await vend.reload();
    return { success: true, vend, lookup };
  }

  /** Applies a Fucil webhook (or poll result) to the matching vend. */
  static async resolveFromFucil(
    reference: string,
    status: 'completed' | 'failed' | 'pending',
    payload: Record<string, unknown>,
    options: { token?: string | null; units?: string | number | null; message?: string | null } = {}
  ): Promise<Vend | null> {
    const vend = await Vend.findOne({ where: { fucilReference: reference } })
      ?? await Vend.findOne({ where: { fucilLookupReference: reference } });

    if (!vend) return null;

    if (status === 'pending') {
      if (vend.status !== 'completed' && vend.status !== 'failed') {
        await vend.update({ status: 'pending', receipt: payload });
      }
      return vend;
    }

    if (status === 'failed') {
      await this.failVend(vend.id, options.message || 'Vend failed', { receipt: payload });
      return vend;
    }

    const units = options.units === null || options.units === undefined ? null : Number(options.units);
    await this.completeVend(vend.id, {
      status: 'completed',
      reference,
      token: options.token ?? null,
      amount: Number(vend.amount),
      units: Number.isFinite(units as number) ? units : null,
      message: options.message ?? null,
      raw: payload
    }, { source: 'webhook', receipt: payload });

    return await Vend.findByPk(vend.id);
  }

  /** Polls Fucil for a vend that returned 202. */
  static async pollPending(vendId: string, scenario?: string | null): Promise<Vend | null> {
    const vend = await Vend.findByPk(vendId);
    if (!vend) return null;
    if (vend.status === 'completed' || vend.status === 'failed') return vend;

    const reference = vend.fucilReference || vend.fucilLookupReference;
    if (!reference) return vend;

    try {
      const response = await FucilService.pollVend(reference, this.scenario(scenario, vend.sandboxScenario));

      if (response.status === 'pending') {
        await vend.update({ status: 'pending' });
        return vend;
      }
      if (response.status === 'failed') {
        await this.failVend(vend.id, response.message || 'Vend failed on poll');
        return await Vend.findByPk(vendId);
      }

      await this.completeVend(vend.id, response, { source: 'poll' });
      return await Vend.findByPk(vendId);
    } catch (error) {
      await this.failVend(vend.id, this.errorOf(error));
      return await Vend.findByPk(vendId);
    }
  }

  /** Marks a vend completed and stamps the bill with the issued token. */
  private static async completeVend(
    vendId: string,
    vendResponse: FucilVendResult,
    options: VendCompletionOptions = {}
  ): Promise<void> {
    await sequelize.transaction(async (t) => {
      const vend = await Vend.findByPk(vendId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!vend) return;

      if (vend.status === 'completed') {
        // A late webhook may still carry the token the first response lacked.
        if (vendResponse.token && !vend.token) {
          await vend.update({ token: vendResponse.token }, { transaction: t });
        }
        return;
      }

      const token = vendResponse.token || vend.token;
      const units = vendResponse.units ?? vend.units;

      await vend.update(
        {
          status: 'completed',
          token: token ?? null,
          units: units ?? null,
          fucilReference: vendResponse.reference || vend.fucilReference,
          failureReason: null,
          resolvedAt: new Date(),
          receipt: options.receipt ?? vendResponse.raw ?? null
        },
        { transaction: t }
      );

      await BillService.markAsPaid(vend.billId, vend.walletReference || `VEND-${vend.id}`, {
        transaction: t,
        token
      });
    });
  }

  /**
   * Marks a vend failed and refunds the user's bot wallet. The refund runs in
   * its own transaction after the status change commits, so a refund failure
   * cannot be lost — the vend simply stays unrefunded for manual handling.
   * Idempotent: a repeated call will not refund twice.
   */
  private static async failVend(
    vendId: string,
    reason: string,
    options: { receipt?: Record<string, unknown> | null } = {}
  ): Promise<void> {
    const failureReason = reason.length > 500 ? `${reason.slice(0, 497)}...` : reason;

    const vend = await sequelize.transaction(async (t) => {
      const row = await Vend.findByPk(vendId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!row) return null;

      if (row.status === 'failed') return row;
      if (row.status === 'completed') return null;

      await row.update(
        {
          status: 'failed',
          failureReason,
          resolvedAt: new Date(),
          receipt: options.receipt ?? row.receipt
        },
        { transaction: t }
      );
      return row;
    });

    if (!vend) return;

    if (vend.refunded || !vend.walletReference) return;

    try {
      await WalletService.refund(vend.userId, vend.amount, {
        reference: vend.walletReference,
        description: 'Refund for failed purchase',
        metadata: {
          vendId: vend.id,
          billId: vend.billId,
          accountId: vend.accountId,
          reason: failureReason
        }
      });
      await vend.update({ refunded: true });
      console.log(`💸 Refunded ${vend.amount} for failed vend ${vend.id}`);
    } catch (error) {
      console.error('Failed to refund user after vend failure:', this.errorOf(error));
    }
  }

  static async getVendByBill(billId: string): Promise<Vend | null> {
    return await Vend.findOne({
      where: { billId },
      include: [{ model: Bill, as: 'bill' }, { model: Account, as: 'account' }]
    });
  }

  static async getVendByReference(fucilReference: string): Promise<Vend | null> {
    return await Vend.findOne({
      where: { fucilReference },
      include: [{ model: Bill, as: 'bill' }, { model: Account, as: 'account' }]
    });
  }
}

export default VendService;
