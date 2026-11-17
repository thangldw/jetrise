import assert from "node:assert/strict";
import test from "node:test";
import { marketEvents, demandEventFactor } from "../src/gameplay.js";

const ctx = (day) => ({ day, gameplay: { startDay: 1, research: [] } });

test("every seventh announced week is a storm that cuts demand", () => {
  const storm = marketEvents(ctx(1 + 6 * 7)).find((e) => e.kind === "storm");
  assert.ok(storm, "week 6 carries a storm");
  assert.ok(storm.factor < 1);
  assert.ok(demandEventFactor(ctx(storm.start), storm.start) < 1);
});

test("weeks before the first storm keep their original tourism, fuel and low-season cycle", () => {
  const kinds = [0, 1, 2, 3, 4, 5].map((w) => marketEvents(ctx(1 + w * 7)).find((e) => e.id === `event-${w}`).kind);
  assert.deepEqual(kinds, ["tourism", "fuel", "low", "tourism", "fuel", "low"]);
});
