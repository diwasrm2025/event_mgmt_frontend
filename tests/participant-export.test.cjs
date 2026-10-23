const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const ExcelJS = require('exceljs');
function load(file) {
 const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
 const mod = { exports: {} }; new Function('exports', 'module', 'require', code)(mod.exports, mod, require); return mod.exports;
}
const commonHeaders = ['S.No', 'Event', 'Full Name', 'Email Address', 'Phone Number', 'Booking status', 'Booking ID', 'Renamed frontend question', 'Consent', 'Registration status', 'Registered at'];
for (const eventType of ['free', 'paid']) test(eventType + ' export matches exact column order and exports all ten participants', async () => {
 const { exportParticipants } = load('participant-export.ts');
 let blob; const oldDocument = global.document; const oldCreate = URL.createObjectURL;
 URL.createObjectURL = value => { blob = value; return 'blob:test'; }; global.document = { createElement: () => ({ click() {} }) };
 try {
  const bookings = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: 'Person ' + i, email: 'a@example.com', phone: '1234567890', responses: { old_key: i === 0 ? '=1+1' : 'Answer ' + i, consent: i === 0, removed: 'Exclude this' }, createdAt: '2026-10-23', status: i === 1 ? 'pending' : 'confirmed', registrationStatus: i === 1 ? 'pending' : 'approved', paymentStatus: 'paid', paymentMethod: eventType === 'free' ? 'free' : 'sbiepay', seats: 1, amount: 100, paidAt: '2026-10-23', transactionId: 'TX1', checkedIn: i === 0, checkedInAt: i === 0 ? '2026-10-23' : null }));
  await exportParticipants({ title: 'Event', slug: 'event', eventType, fields: [{ name: 'old_key', label: 'Renamed frontend question', order: 0, type: 'text' }, { name: 'consent', label: 'Consent', order: 1, type: 'checkbox' }] }, bookings, { canApprovePayment: true, canCheckIn: true });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await blob.arrayBuffer()); const sheet = workbook.worksheets[0];
  const headers = [...commonHeaders, ...(eventType === 'paid' ? ['Amount', 'Payment method', 'Payment status', 'paidAt', 'transactionId'] : []), 'checkedIn', 'checkedInAt'];
  assert.deepEqual(sheet.getRow(1).values.slice(1), headers); assert.equal(sheet.rowCount, 11);
  const cell = (row, label) => sheet.getRow(row).getCell(headers.indexOf(label) + 1).value;
  assert.equal(cell(2, 'S.No'), 1); assert.equal(cell(11, 'S.No'), 10);
  assert.equal(cell(2, 'Renamed frontend question'), '=1+1'); assert.equal(cell(11, 'Renamed frontend question'), 'Answer 9');
  assert.equal(cell(2, 'Registration status'), 'Completed'); assert.equal(cell(3, 'Registration status'), 'Pending');
  assert.equal(cell(2, 'checkedIn'), 'Yes'); assert.equal(cell(3, 'checkedIn'), 'No');
  assert.equal(cell(2, 'Consent'), 'Yes'); assert.equal(cell(3, 'Consent'), 'No');
 } finally { global.document = oldDocument; URL.createObjectURL = oldCreate; }
});
