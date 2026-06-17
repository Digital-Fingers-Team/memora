import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captureInputSchema, harvestResultSchema } from "./index";

describe("shared schemas", () => {
  it("validates a text capture", () => {
    assert.equal(captureInputSchema.parse({ type: "text", content: "A useful thought" }).type, "text");
  });

  it("ignores blank optional capture fields", () => {
    const input = captureInputSchema.parse({
      type: "text",
      title: "   ",
      content: " A useful thought ",
      sourceUrl: "   "
    });

    assert.equal(input.title, undefined);
    assert.equal(input.content, "A useful thought");
    assert.equal(input.sourceUrl, undefined);
  });

  it("rejects invalid capture source URLs", () => {
    assert.throws(() => captureInputSchema.parse({ type: "url", content: "Notes", sourceUrl: "not-a-url" }));
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
