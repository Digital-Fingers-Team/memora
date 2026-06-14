import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captureInputSchema, harvestResultSchema } from "./index";

describe("shared schemas", () => {
  it("validates a text capture", () => {
    assert.equal(captureInputSchema.parse({ type: "text", content: "A useful thought" }).type, "text");
  });

  it("rejects invalid harvest confidence scores", () => {
    assert.throws(() =>
      harvestResultSchema.parse({
        title: "x",
        structuredSummary: "y",
        confidenceScore: 2
      })
    );
  });
});
