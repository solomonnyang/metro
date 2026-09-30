/**
 * Exercises the Fucil client against the live sandbox. Run with:
 *   FUCIL_API_KEY=<key> node dist/scripts/fucil-check.js
 * Defaults to the sandbox_scenario that mirrors the behaviour under test.
 */
import FucilService from '../services/fucil.js';

const run = async () => {
  if (!FucilService.isConfigured()) {
    console.error('FUCIL_API_KEY is not set');
    process.exit(1);
  }

  const section = (title: string) => console.log(`\n=== ${title} ===`);

  section('health');
  try {
    console.log('healthy:', await FucilService.health());
  } catch (error) {
    console.log('FAILED:', error instanceof Error ? error.message : error);
  }

  section('wallet balance');
  try {
    console.log('balance:', await FucilService.getWalletBalance());
  } catch (error) {
    console.log('FAILED:', error instanceof Error ? error.message : error);
  }

  section('discos');
  try {
    const discos = await FucilService.listDiscos();
    console.log(discos.length ? discos : 'empty');
  } catch (error) {
    console.log('FAILED:', error instanceof Error ? error.message : error);
  }

  section('lookup (success)');
  let reference: string | null = null;
  try {
    const lookup = await FucilService.lookup(
      { disco: 'APLE', meterType: 'Prepaid', meter: '0101160395519', amount: 3000 },
      'success'
    );
    reference = lookup.reference;
    console.log('reference:', reference);
    console.log('customerName:', lookup.customerName);
    console.log('meterType:', lookup.meterType);
    console.log('amount:', lookup.amount);
    console.log('raw keys:', Object.keys(lookup.raw).join(', '));
  } catch (error) {
    console.log('FAILED:', error instanceof Error ? error.message : error);
  }

  if (reference) {
    section('vend (success)');
    try {
      const result = await FucilService.vend({ reference, amount: 3000 }, 'success');
      console.log('status:', result.status);
      console.log('token:', result.token);
      console.log('units:', result.units);
      console.log('raw keys:', Object.keys(result.raw).join(', '));
    } catch (error) {
      console.log('FAILED:', error instanceof Error ? error.message : error);
    }
  }

  section('lookup (lookup_fail — meter 0000000000000)');
  try {
    await FucilService.lookup(
      { disco: 'APLE', meterType: 'Prepaid', meter: '0000000000000', amount: 3000 },
      'lookup_fail'
    );
    console.log('unexpectedly succeeded');
  } catch (error) {
    console.log('rejected as expected:', error instanceof Error ? error.message : error);
  }

  section('lookup + vend (pending)');
  try {
    const lookup = await FucilService.lookup(
      { disco: 'APLE', meterType: 'Prepaid', meter: '0101160395519', amount: 3000 },
      'pending'
    );
    const result = await FucilService.vend({ reference: lookup.reference, amount: 3000 }, 'pending');
    console.log('status:', result.status);
    console.log('reference:', result.reference);
  } catch (error) {
    console.log('FAILED:', error instanceof Error ? error.message : error);
  }

  section('vend (failed)');
  try {
    const lookup = await FucilService.lookup(
      { disco: 'APLE', meterType: 'Prepaid', meter: '0101160395519', amount: 3000 },
      'failed'
    );
    const result = await FucilService.vend({ reference: lookup.reference, amount: 3000 }, 'failed');
    console.log('status:', result.status);
    console.log('message:', result.message);
  } catch (error) {
    console.log('error thrown:', error instanceof Error ? error.message : error);
  }
};

run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
