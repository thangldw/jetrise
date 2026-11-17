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
