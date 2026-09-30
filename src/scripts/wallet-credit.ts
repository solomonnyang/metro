import { initModels } from '../models/index.js';
import UserService from '../services/userService.js';
import WalletService from '../services/walletService.js';

/**
 * Development helper: credits a user's wallet without going through Paystack,
 * so the vending flow can be exercised end to end. Goes through
 * `WalletService.creditTopup` so the ledger row is written the same way a real
 * top-up would be, and is idempotent on the reference.
 *
 * Usage: node dist/scripts/wallet-credit.js <telegramId> <amount> [reference]
 */
const run = async () => {
  initModels();

  const [telegramId, amount, reference] = process.argv.slice(2);

  if (!telegramId || !amount) {
    console.error('Usage: node dist/scripts/wallet-credit.js <telegramId> <amount> [reference]');
    process.exit(1);
  }

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    console.error('Amount must be a positive number');
    process.exit(1);
  }

  const user = await UserService.getUserByTelegramId(telegramId);
  if (!user) {
    console.error(`No user with telegramId ${telegramId}`);
    process.exit(1);
  }

  const ref = reference || `MANUAL-${telegramId}-${Date.now()}`;
  const result = await WalletService.creditTopup(user.id, value, {
    reference: ref,
    description: 'Manual test credit (no Paystack)',
    metadata: { source: 'wallet-credit-script' }
  });

  console.log(
    result.alreadyCredited
      ? `Already credited (${ref}). Balance: NGN ${result.balance}`
      : `Credited NGN ${value.toFixed(2)} (${ref}). Balance: NGN ${result.balance}`
  );
  process.exit(0);
};

run().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
