const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Load the actual TypeScript helpers without adding a test runner dependency.
const source = fs.readFileSync(path.join(__dirname, "../lib/event-validation.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function("exports", "module", compiled)(loaded.exports, loaded);
const { isValidCapacity, isValidTicketPrice, isValidDate, isValidHttpUrl, isValidEmail, isValidPhone, validateRegistrationField } = loaded.exports;
const field = (type, required = true) => ({ name: "answer", label: "Answer", type, required, options: ["One", "Two"] });

test("paid prices accept paise and reject zero, negative, nonfinite and excess precision", () => {
  for (const value of [0.01, 1, 499.99, 0.1 + 0.2]) assert.equal(isValidTicketPrice(value), true);
  for (const value of [0, -1, NaN, Infinity, 1.001]) assert.equal(isValidTicketPrice(value), false);
});

test("capacity requires whole seats and cannot drop below existing bookings", () => {
  assert.equal(isValidCapacity(100, 80), true);
  for (const value of [0, -1, 1.5, NaN, Infinity, 2147483648]) assert.equal(isValidCapacity(value), false);
  assert.equal(isValidCapacity(79, 80), false);
});

test("dates reject impossible days and URLs only accept web protocols", () => {
  assert.equal(isValidDate("2028-02-29"), true);
  for (const value of ["2026-02-29", "2026-13-01", "", "tomorrow"]) assert.equal(isValidDate(value), false);
  assert.equal(isValidHttpUrl("https://meet.example.com/room"), true);
  for (const value of ["javascript:alert(1)", "ftp://example.com", "example.com", ""]) assert.equal(isValidHttpUrl(value), false);
});

test("attendee contact validation accepts formatted phones and rejects malformed input", () => {
  assert.equal(isValidEmail(" user@example.com "), true);
  assert.equal(isValidEmail("invalid@"), false);
  assert.equal(isValidPhone("+91 98765 43210"), true);
  for (const value of ["123", "call 9876543210", "1234567890123456"]) assert.equal(isValidPhone(value), false);
});

test("required text rejects whitespace and required checkbox needs consent", () => {
  assert.ok(validateRegistrationField(field("text"), "   "));
  assert.ok(validateRegistrationField(field("checkbox"), false));
  assert.equal(validateRegistrationField(field("checkbox"), true), null);
  assert.equal(validateRegistrationField(field("text", false), ""), null);
});

test("custom fields validate email, phone, number, date and allowed choices", () => {
  for (const [type, value] of [["email", "bad"], ["phone", "12"], ["number", "Infinity"], ["date", "2026-02-30"], ["select", "Other"], ["radio", "Other"]]) {
    assert.ok(validateRegistrationField(field(type), value));
  }
  for (const [type, value] of [["number", "0"], ["number", "-1.5"], ["select", "One"], ["radio", "Two"], ["textarea", "A longer answer"]]) {
    assert.equal(validateRegistrationField(field(type), value), null);
  }
});
