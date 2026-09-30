import { initModels } from '../models/index.js';
import PaymentService from '../services/paymentService.js';

/**
 * Reconciles payments that never settled: verifies every pending/failed payment
 * against Paystack and applies the ones that were actually captured.
 *
 * This is the escape hatch for a missed webhook — for example when the app was
 * unreachable at the moment Paystack sent `charge.success`. It only touches
 * payments Paystack confirms as `success`, and the wallet credit is idempotent
 * on the reference, so it is safe to re-run.
 *
 * Usage:
 *   node dist/scripts/reconcile-payments.js               # all unsettled payments
 *   node dist/scripts/reconcile-payments.js <reference>   # one payment
 */
const run = async () => {
  initModels();

  const [reference] = process.argv.slice(2);

  const rows = reference
    ? [await PaymentService.getPaymentByReference(reference)]
    : await PaymentService.listUnreconciled();

  const payments = rows.filter((payment) => payment !== null);

  if (payments.length === 0) {
    console.log(reference ? `No local payment with reference ${reference}` : 'Nothing to reconcile.');
    process.exit(0);
  }

  console.log(`Reconciling ${payments.length} payment(s)...\n`);

  let settled = 0;
  let stillOpen = 0;

  for (const payment of payments) {
    const ref = payment.paystackReference;

    if (!ref) {
      stillOpen += 1;
      console.log(`• ${payment.id}  skipped (no Paystack reference)`);
      continue;
    }

    const result = await PaymentService.verifyPayment(ref);

    if (result.success) {
      settled += 1;
      const balance = 'walletBalance' in result ? ` | wallet now NGN ${result.walletBalance}` : '';
      console.log(`✔ ${ref}  ${payment.status} -> success  (NGN ${payment.amount})${balance}`);
    } else {
      stillOpen += 1;
      console.log(`• ${ref}  stays ${payment.status}  (${result.error})`);
    }
  }

  console.log(`\nSettled ${settled}, still open ${stillOpen}.`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Reconcile failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
