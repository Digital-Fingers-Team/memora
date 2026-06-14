import crypto from "node:crypto";
import { Types } from "mongoose";
import { Embedding, KnowledgeObject } from "../models";
import { embedWithOpenRouter } from "./openrouter";
import { getEffectiveSettings } from "./settings";

export function contentHash(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function embedKnowledgeObject(ownerId: string, knowledgeObjectId: string) {
  const object = await KnowledgeObject.findOne({ _id: knowledgeObjectId, ownerId });
  if (!object) return null;
  const text = [object.title, object.structuredSummary, object.rawContent, object.tags.join(" ")].filter(Boolean).join("\n");
  const settings = await getEffectiveSettings(ownerId);
  const vector = await embedWithOpenRouter(text, ownerId);
  return Embedding.findOneAndUpdate(
    { ownerId, refType: "knowledgeObject", refId: object._id },
    {
      $set: {
        ownerId: new Types.ObjectId(ownerId),
        refType: "knowledgeObject",
        refId: object._id,
        vector,
        contentHash: contentHash(text),
        provider: "openrouter",
        model: settings.embeddingModel,
        dimensions: vector.length
      }
    },
    { new: true, upsert: true }
  );
}

export function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  return dot / ((Math.sqrt(aMag) || 1) * (Math.sqrt(bMag) || 1));
}
