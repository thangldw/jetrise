import assert from "node:assert/strict";
import test from "node:test";
import { weatherKind, weatherFactor, WEATHER_EFFECT } from "../src/gameplay.js";

test("weather is deterministic for an airport and day", () => {
  for (const day of [1, 2, 30, 208]) assert.equal(weatherKind("HAN", day), weatherKind("HAN", day));
});

test("storms and fog are rare but do occur, and airports differ", () => {
  const counts = { clear: 0, fog: 0, storm: 0 };
  const airports = ["HAN", "SGN", "DAD", "SIN", "HND", "BKK", "ICN", "SYD"];
  for (const airport of airports) for (let day = 1; day <= 365; day++) counts[weatherKind(airport, day)]++;
  const total = airports.length * 365;
  assert.ok(counts.storm / total > 0.03 && counts.storm / total < 0.1, `storm share ${counts.storm / total}`);
  assert.ok(counts.fog / total > 0.06 && counts.fog / total < 0.15, `fog share ${counts.fog / total}`);
  const hanDays = Array.from({ length: 60 }, (_, i) => weatherKind("HAN", i + 1)).join();
  const sgnDays = Array.from({ length: 60 }, (_, i) => weatherKind("SGN", i + 1)).join();
  assert.notEqual(hanDays, sgnDays);
});

test("a route is hit by the weather at either end and legacy careers are untouched", () => {
  const ctx = { gameplay: {} };
  const stormDay = Array.from({ length: 400 }, (_, i) => i + 1).find((d) => weatherKind("HAN", d) === "storm");
  assert.ok(stormDay);
  assert.ok(weatherFactor(ctx, "HAN", "SGN", stormDay) <= WEATHER_EFFECT.storm);
  assert.ok(weatherFactor(ctx, "SGN", "HAN", stormDay) <= WEATHER_EFFECT.storm);
  assert.equal(weatherFactor({}, "HAN", "SGN", stormDay), 1);
});

import { weatherOutlookDays, RESEARCH, RESEARCH_BRANCHES } from "../src/research.js";
import { weatherDelayHint, WEATHER_DELAY_HOURS } from "../src/disruption-recovery.js";

test("forecasting research extends the weather outlook from 3 to 7 days", () => {
  const s = { day: 10, tycoon: { research: [] }, hq: {} };
  assert.equal(weatherOutlookDays(s), 3);
  s.tycoon.research = ["weatherDesk"]; assert.equal(weatherOutlookDays(s), 4);
  s.tycoon.research.push("weatherModels"); assert.equal(weatherOutlookDays(s), 5);
  s.tycoon.research.push("weatherRadar"); assert.equal(weatherOutlookDays(s), 7);
  s.tycoon.research = []; s.hq.researchProject = { key: "weatherDesk", startedDay: 8, readyDay: 10 };
  assert.equal(weatherOutlookDays(s), 4, "a project counts on its due day");
  assert.equal(weatherOutlookDays(s, 9), 3);
  assert.ok(RESEARCH_BRANCHES.find((b) => b.id === "forecasting").keys.every((k) => RESEARCH[k].branch === "forecasting"));
});

test("bad weather at either end of a leg suggests a deterministic delay", () => {
  const day = Array.from({ length: 400 }, (_, i) => i + 1).find((d) => weatherKind("HAN", d) === "storm");
  const leg = { from: "HAN", to: "SGN", departure: (day - 1) * 24 + 8, arrival: (day - 1) * 24 + 10 };
  const hint = weatherDelayHint({ gameplay: {} }, leg);
  assert.equal(hint.kind, "storm"); assert.equal(hint.delay, WEATHER_DELAY_HOURS.storm);
  assert.deepEqual(weatherDelayHint({ gameplay: {} }, leg), hint);
  assert.equal(weatherDelayHint({}, leg), null, "legacy careers get no hints");
  const clearDay = Array.from({ length: 400 }, (_, i) => i + 1).find((d) => weatherKind("HAN", d) === "clear" && weatherKind("SGN", d) === "clear");
  assert.equal(weatherDelayHint({ gameplay: {} }, { from: "HAN", to: "SGN", departure: (clearDay - 1) * 24 + 8, arrival: (clearDay - 1) * 24 + 9 }), null);
});
