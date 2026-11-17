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
    assert.equal(game.cash, 500000000, "scenarios never change the starting cash");
    assert.deepEqual(restoreGame(JSON.stringify(game)), game);
  }
});
