import assert from "node:assert/strict";
import test from "node:test";
import { guidedEnabled, visibleTabs, nextUnlock, GUIDED_KEY } from "../src/guided-mode.js";

const TABS = [["hubs", "a"], ["finance", "b"], ["decisions", "c"], ["weekly", "d"], ["staff", "e"], ["services", "f"], ["development", "g"]];
const keys = (list) => list.map(([k]) => k);

test("guided mode is on unless the player turned it off", () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null };
  assert.equal(guidedEnabled(storage), true);
  memory.set(GUIDED_KEY, "off");
  assert.equal(guidedEnabled(storage), false);
  assert.equal(guidedEnabled({ getItem() { throw new Error("blocked"); } }), true);
});

test("tabs unlock on schedule and a deep-linked tab stays visible", () => {
  assert.deepEqual(keys(visibleTabs(TABS, { day: 1, enabled: true, current: "hubs" })), ["hubs", "finance", "staff"]);
  assert.deepEqual(keys(visibleTabs(TABS, { day: 4, enabled: true, current: "hubs" })), ["hubs", "finance", "weekly", "staff", "services"]);
  assert.equal(visibleTabs(TABS, { day: 8, enabled: true, current: "hubs" }).length, TABS.length);
  assert.ok(keys(visibleTabs(TABS, { day: 1, enabled: true, current: "decisions" })).includes("decisions"));
  assert.equal(visibleTabs(TABS, { day: 1, enabled: false, current: "hubs" }).length, TABS.length);
});

test("nextUnlock reports when more tabs arrive", () => {
  assert.equal(nextUnlock(TABS, 1), 4);
  assert.equal(nextUnlock(TABS, 4), 8);
  assert.equal(nextUnlock(TABS, 8), null);
});
