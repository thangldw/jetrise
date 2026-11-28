import assert from "node:assert/strict";
import test from "node:test";
import { createGame, transition, restoreGame } from "../src/game.js";
import { SCENARIOS, scenarioSetup } from "../src/scenarios.js";

test("every scenario founds a valid airline with its own hub and aircraft", () => {
  assert.ok(SCENARIOS.length >= 3);
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
  for (const scenario of SCENARIOS) {
    const result = transition(createGame(), scenarioSetup(scenario));
    assert.ok(!result.error, `${scenario.id}: ${result.error}`);
    const game = result.game;
    assert.equal(game.airline.origin, scenario.origin);
    assert.deepEqual(game.fleet.map((p) => p.type), scenario.models);
    assert.equal(game.cash, 100000000, "scenarios never change the starting cash");
    assert.deepEqual(restoreGame(JSON.stringify(game)), game);
  }
});

test("scenario market follows where the player is, not the UI language", async () => {
  const { detectMarket, scenariosFor, SCENARIO_SETS } = await import("../src/scenarios.js");
  assert.equal(detectMarket({ languages: ["vi-VN"], timeZone: "Asia/Tokyo" }), "jp");
  assert.equal(detectMarket({ languages: ["en-US"], timeZone: "Europe/Berlin" }), "eu");
  assert.equal(detectMarket({ languages: ["en-GB"], timeZone: "UTC" }), "gb");
  assert.equal(detectMarket({ languages: ["ko"], timeZone: "" }), "kr");
  assert.equal(detectMarket({ languages: ["en"], timeZone: "America/Sao_Paulo" }), "global");
  assert.equal(detectMarket({}), "global");
  assert.equal(scenariosFor("nowhere"), SCENARIO_SETS.global);
  for (const set of Object.values(SCENARIO_SETS)) assert.equal(set.length, 4);
});
