/**
 * End-to-end exercise of the vend lifecycle against the Fucil sandbox and the
 * local database, without touching Telegram. Run with:
 *   node dist/scripts/vend-e2e.js
 *
 * Creates a throwaway user, meter, wallet balance and bill, then drives
 * lookup/vend and asserts the token lands on the bill and the wallet.
 */
import sequelize from '../config/database.js';
import { initModels, User, Account, Bill, WalletTransaction, Vend } from '../models/index.js';
import WalletService from '../services/walletService.js';
import BillService from '../services/billService.js';
import VendService from '../services/vendService.js';
import FucilService from '../services/fucil.js';
import { toDiscoCode } from '../utils/discos.js';

const SCENARIO = process.env.E2E_SCENARIO || 'success';
const AMOUNT = 3000;

let pass = 0;
let fail = 0;

const check = (label: string, condition: boolean, detail = '') => {
  if (condition) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const banner = (title: string) => console.log(`\n=== ${title} (scenario: ${SCENARIO}) ===`);

const run = async () => {
  initModels();
  await sequelize.authenticate();

  const suffix = `${Date.now()}`;
  const telegramId = `99900${String(Date.now()).slice(-6)}`;

  const user = await User.create({
    telegramId,
    firstName: 'E2E',
    lastName: 'Test',
    walletBalance: AMOUNT * 4
  });

  const account = await Account.create({
    userId: user.id,
    meterNumber: `81004567${String(Date.now()).slice(-3)}`,
    accountName: 'E2E Meter',
    accountType: 'prepaid',
    distributionCompany: 'Abuja Electric'
  });

  const created: string[] = [];
  const cleanup = async () => {
    await Vend.destroy({ where: { userId: user.id } });
    await WalletTransaction.destroy({ where: { userId: user.id } });
    await Bill.destroy({ where: { accountId: account.id } });
    await Account.destroy({ where: { id: account.id } });
    await User.destroy({ where: { id: user.id } });
  };

  try {
    banner('config');
    check('FUCIL_API_KEY set', FucilService.isConfigured());
    check('Fucil healthy', await FucilService.health());
    check('disco resolves', toDiscoCode(account.distributionCompany) === 'AEDC', String(toDiscoCode(account.distributionCompany)));

    // --- scenario: success -------------------------------------------------
    banner('purchase → token');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const bill = await BillService.generateBill(account.id, AMOUNT, dueDate, 'Test Period', null, null);
    created.push(bill.id);

    const balanceBefore = await WalletService.getBalance(user.id);
    const debit = await WalletService.debitForBill(user.id, bill.id, { sandboxScenario: SCENARIO });
    check('debit succeeded', debit.success, debit.success ? '' : debit.error);

    if (debit.success) {
      check('wallet debited', debit.balance === balanceBefore - AMOUNT, `${balanceBefore} -> ${debit.balance}`);
      check('vend row created', Boolean(debit.vend?.id));
    }

    const vendResult = await VendService.initiateVend(bill.id, { sandboxScenario: SCENARIO });
    const vend = await Vend.findByPk(debit.vend!.id);

    if (SCENARIO === 'success') {
      check('vend succeeded', vendResult.success, vendResult.success ? '' : vendResult.error);
      check('vend completed', vend?.status === 'completed', String(vend?.status));
      check('fucil reference stored', Boolean(vend?.fucilReference));
      check('token stored on vend', Boolean(vend?.token), String(vend?.token));
      check('units stored', Boolean(vend?.units), String(vend?.units));

      const paidBill = await Bill.findByPk(bill.id);
      check('bill marked paid', paidBill?.status === 'paid', String(paidBill?.status));
      check('token on bill', Boolean(paidBill?.token), String(paidBill?.token));
      check('not refunded', vend?.refunded === false);
    }

    if (SCENARIO === 'pending') {
      check('vend reported success', vendResult.success, vendResult.success ? '' : vendResult.error);
      check('vend pending', vend?.status === 'pending', String(vend?.status));
      const pendingBill = await Bill.findByPk(bill.id);
      check('bill still pending', pendingBill?.status === 'pending', String(pendingBill?.status));
      check('wallet still debited', await WalletService.getBalance(user.id) === balanceBefore - AMOUNT);

      // Resolve the pending vend the way the webhook would.
      const reference = vend?.fucilReference!;
      await VendService.resolveFromFucil(reference, 'completed', { token: '11112222333344445555', units: 60 }, {
        token: '11112222333344445555',
        units: 60
      });
      const resolved = await Vend.findByPk(vend!.id);
      const resolvedBill = await Bill.findByPk(bill.id);
      check('webhook completed the vend', resolved?.status === 'completed', String(resolved?.status));
      check('webhook token stored', resolved?.token === '11112222333344445555', String(resolved?.token));
      check('bill paid after webhook', resolvedBill?.status === 'paid', String(resolvedBill?.status));
    }

    if (SCENARIO === 'failed') {
      check('vend reported failure', !vendResult.success, vendResult.success ? '' : vendResult.error);
      const failedVend = await Vend.findByPk(debit.vend!.id);
      check('vend marked failed', failedVend?.status === 'failed', String(failedVend?.status));
      check('failure reason recorded', Boolean(failedVend?.failureReason));
      check('refunded', failedVend?.refunded === true, String(failedVend?.refunded));
      check('wallet restored', await WalletService.getBalance(user.id) === balanceBefore, String(await WalletService.getBalance(user.id)));
      const failedBill = await Bill.findByPk(bill.id);
      check('bill not paid', failedBill?.status !== 'paid', String(failedBill?.status));
    }

    // --- double-spend guard ------------------------------------------------
    banner('double-spend guard');
    const second = await WalletService.debitForBill(user.id, bill.id);
    check('second debit refused', !second.success, second.success ? 'was allowed' : second.error);

    // --- lookup failure (bad meter) ---------------------------------------
    banner('lookup failure refunds');
    const badAccount = await Account.create({
      userId: user.id,
      meterNumber: '0000000000000',
      accountName: 'Bad Meter',
      accountType: 'prepaid',
      distributionCompany: 'Abuja Electric'
    });
    const badBill = await BillService.generateBill(badAccount.id, AMOUNT, dueDate, 'Test Period', null, null);
    const balBeforeBad = await WalletService.getBalance(user.id);
    const badDebit = await WalletService.debitForBill(user.id, badBill.id, { sandboxScenario: 'lookup_fail' });
    check('bad-meter debit succeeded locally', badDebit.success);

    if (badDebit.success) {
      const badResult = await VendService.initiateVend(badBill.id, { sandboxScenario: 'lookup_fail' });
      check('lookup failure surfaced', !badResult.success, badResult.success ? '' : badResult.error);
      const badVend = await Vend.findByPk(badDebit.vend!.id);
      check('bad vend marked failed', badVend?.status === 'failed', String(badVend?.status));
      check('bad vend refunded', badVend?.refunded === true, String(badVend?.refunded));
      check('balance restored after lookup failure', await WalletService.getBalance(user.id) === balBeforeBad);
    }
    await Account.destroy({ where: { id: badAccount.id } });

    // --- meter validation ---------------------------------------------------
    banner('meter validation');
    const goodMeter = await FucilService.validateMeter(
      { disco: 'AEDC', meterType: 'Prepaid', meter: '0101160395519' },
      'success'
    );
    check('valid meter accepted', Boolean(goodMeter.reference));
    check('customer name returned', Boolean(goodMeter.customerName), String(goodMeter.customerName));
    check('address returned', Boolean(goodMeter.customerAddress), String(goodMeter.customerAddress));
    check('meter echoed back', goodMeter.meter === '0101160395519', String(goodMeter.meter));

    const postpaidLookup = await FucilService.validateMeter(
      { disco: 'AEDC', meterType: 'Postpaid', meter: '0101160395519' },
      'success'
    );
    check('postpaid meter_type accepted', postpaidLookup.meterType === 'Postpaid', String(postpaidLookup.meterType));

    let invalidRejected = false;
    try {
      await FucilService.validateMeter(
        { disco: 'AEDC', meterType: 'Prepaid', meter: '0000000000000' },
        'lookup_fail'
      );
    } catch (error) {
      invalidRejected = true;
      check('invalid meter message surfaced', /lookup failed/i.test(error instanceof Error ? error.message : ''));
    }
    check('invalid meter rejected', invalidRejected);

    // --- webhook signature -------------------------------------------------
    banner('webhook signature');
    const crypto = await import('crypto');
    const secret = 'local-test-secret';
    const payload = '{"event":"vend.completed","data":{"reference":"X"}}';
    const ts = Math.floor(Date.now() / 1000).toString();
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
    process.env.FUCIL_WEBHOOK_SECRET = secret;
    check('valid signature accepted', FucilService.verifyWebhookSignatureRaw(payload, expected, ts));
    check('tampered body rejected', !FucilService.verifyWebhookSignatureRaw(`${payload} `, expected, ts));
    check('wrong secret rejected', !FucilService.verifyWebhookSignatureRaw(payload, 'sha256=deadbeef', ts));
    check('missing timestamp rejected', !FucilService.isTimestampFresh(undefined));
    check('fresh timestamp accepted', FucilService.isTimestampFresh(ts));
    check('stale timestamp rejected', !FucilService.isTimestampFresh(String(Number(ts) - 3600)));
  } finally {
    await cleanup();
    await sequelize.close();
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error('E2E run failed:', error);
  process.exit(1);
});
