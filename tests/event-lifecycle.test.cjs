const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../lib/event-lifecycle.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', compiled)(loaded.exports, loaded);
const { isCompletedEvent } = loaded.exports;
test('current and completed tabs split at the event time, including today', () => {
  const event = { date: '2026-11-17', time: '14:00', status: 'published' };
  const now = Date.parse('2026-11-17T08:30:00Z');
  assert.equal(isCompletedEvent(event, now - 1), false);
  assert.equal(isCompletedEvent(event, now), true);
  assert.equal(isCompletedEvent({ ...event, status: 'draft' }, now), true);
  assert.equal(isCompletedEvent({ ...event, date: '', time: '' }, now), false);
  assert.equal(isCompletedEvent({ ...event, date: '2027-01-01', status: 'completed' }, now), true);
});
