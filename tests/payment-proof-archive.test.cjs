const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const JSZip = require('jszip');

function loadArchiveModule() {
  const source = fs.readFileSync(path.join(__dirname, '../lib/payment-proof-archive.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', 'require', code)(module.exports, module, require);
  return module.exports;
}

test('payment screenshot archives include every image with safe, unique attendee-transaction filenames', async () => {
  const { buildPaymentProofArchive } = loadArchiveModule();
  const bytes = await buildPaymentProofArchive([
    { bookingId: 'booking-1', name: 'Alex Lee', transactionId: 'UTR-123', proof: new Blob(['first'], { type: 'image/png' }) },
    { bookingId: 'booking-2', name: 'Alex Lee', transactionId: 'UTR-123', proof: new Blob(['second'], { type: 'image/png' }) },
  ]);
  const archive = await JSZip.loadAsync(bytes);
  assert.deepEqual(Object.keys(archive.files).sort(), ['Alex-Lee-UTR-123-booking-2.png', 'Alex-Lee-UTR-123.png']);
  assert.equal(await archive.file('Alex-Lee-UTR-123.png').async('string'), 'first');
  assert.equal(await archive.file('Alex-Lee-UTR-123-booking-2.png').async('string'), 'second');
});

test('payment screenshot archives reject empty or non-image proofs', async () => {
  const { buildPaymentProofArchive } = loadArchiveModule();
  await assert.rejects(buildPaymentProofArchive([
    { bookingId: 'booking-1', name: 'Alex Lee', transactionId: 'UTR-123', proof: new Blob(['not an image'], { type: 'text/plain' }) },
  ]), /empty or invalid/);
});
