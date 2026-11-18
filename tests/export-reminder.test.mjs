import assert from "node:assert/strict";
import test from "node:test";
import { exportReminderDue, markExported, EXPORT_DAY_KEY } from "../src/export-reminder.js";

const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
};

test("no reminder during the first week", () => {
  assert.equal(exportReminderDue(memory(), 7), false);
});

test("a reminder is due once a week has passed without an export", () => {
  assert.equal(exportReminderDue(memory(), 8), true);
});

test("exporting resets the interval and the player is reminded at most once per interval", () => {
  const s = memory();
  markExported(s, 10);
  assert.equal(s.getItem(EXPORT_DAY_KEY), "10");
  assert.equal(exportReminderDue(s, 16), false);
  assert.equal(exportReminderDue(s, 17), true);
  assert.equal(exportReminderDue(s, 20, 17), false);
});

test("blocked storage never throws", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.doesNotThrow(() => markExported(broken, 3));
  assert.equal(exportReminderDue(broken, 9), true);
});
