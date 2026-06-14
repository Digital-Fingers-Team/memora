import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heuristicHarvest } from "./heuristics";

describe("heuristicHarvest", () => {
  it("produces a valid fallback harvest result", () => {
    const result = heuristicHarvest("We learned that retention is risky. Should we revisit onboarding?", "Retention note");
    assert.equal(result.title, "Retention note");
    assert.ok(result.risks.length > 0);
    assert.ok(result.questions.length > 0);
    assert.ok(result.confidenceScore > 0);
  });
});
