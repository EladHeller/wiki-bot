/**
 * Smoke test to verify that all production entry points can be imported
 * in a standard Node.js environment without ESM/CJS interop issues.
 */
import { JSDOM } from 'jsdom';

const entryPoints = [
  '../bot/maintenance/copyrightViolationCore.ts',
  '../bot/usMarketValue/index.ts',
  '../bot/kineret/index.ts',
  '../bot/admin/deleteRedirects.ts',
  '../bot/exchangeRates/index.ts',
  '../bot/indexesBot/index.ts',
  '../bot/recordCharts/index.ts',
];

async function runSmokeTest() {
  console.log('Starting production dependency smoke test...');

  // 1. Verify JSDOM separately as it was the source of the recent regression
  try {
    const dom = new JSDOM('<!DOCTYPE html><p>Hello</p>');
    if (dom.window.document.querySelector('p')?.textContent !== 'Hello') {
      throw new Error('JSDOM basic functionality failed');
    }
    console.log('✅ JSDOM basic check passed');
  } catch (e) {
    console.error('❌ JSDOM check failed:', e.message);
    process.exit(1);
  }

  // 2. Attempt to import all major entry points
  // Note: We use the TS files because they are what we work with,
  // and in this project they are likely run via tsx or compiled.
  // This test ensures that the static imports/requires in these files
  // don't trigger ERR_REQUIRE_ESM or similar at load time.
  for (const entry of entryPoints) {
    try {
      await import(entry);
      console.log(`✅ Imported ${entry}`);
    } catch (e) {
      console.error(`❌ Failed to import ${entry}:`, e.message);
      if (e.stack) console.error(e.stack);
      process.exit(1);
    }
  }

  console.log('✅ All production entry points imported successfully!');
}

runSmokeTest();
