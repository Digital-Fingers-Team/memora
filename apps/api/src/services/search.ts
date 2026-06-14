import { Types } from "mongoose";
import { Embedding, KnowledgeObject } from "../models";
import { embedWithOpenRouter } from "./openrouter";
import { cosineSimilarity } from "./embedding";

export async function semanticSearch(ownerId: string, query: string, limit = 10) {
  const vector = await embedWithOpenRouter(query, ownerId);

  try {
    const results = await Embedding.aggregate([
      {
        $vectorSearch: {
          index: "knowledge_vector_index",
          path: "vector",
          queryVector: vector,
          numCandidates: Math.max(limit * 10, 50),
          limit,
          filter: { ownerId: new Types.ObjectId(ownerId), refType: "knowledgeObject" }
        }
      },
      { $project: { refId: 1, score: { $meta: "vectorSearchScore" } } }
    ]);
    const ids = results.map((result) => result.refId);
    const objects = await KnowledgeObject.find({ _id: { $in: ids }, ownerId });
    return ids
      .map((id) => {
        const object = objects.find((item) => item._id.equals(id));
        const score = results.find((item) => item.refId.equals(id))?.score ?? 0;
        return object ? { object, score } : null;
      })
      .filter(Boolean);
  } catch {
    const embeddings = await Embedding.find({ ownerId, refType: "knowledgeObject" }).limit(500);
    const scored = embeddings
      .map((embedding) => ({ embedding, score: cosineSimilarity(vector, embedding.vector as number[]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const ids = scored.map((item) => item.embedding.refId);
    const objects = await KnowledgeObject.find({ _id: { $in: ids }, ownerId });
    return scored
      .map(({ embedding, score }) => {
        const object = objects.find((item) => item._id.equals(embedding.refId));
        return object ? { object, score } : null;
      })
      .filter(Boolean);
  }
}

export async function hybridSearch(ownerId: string, query: string, limit = 10) {
  const [semantic, text] = await Promise.all([
    semanticSearch(ownerId, query, limit),
    KnowledgeObject.find({ ownerId, $text: { $search: query } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
  ]);

  const merged = new Map<string, { object: any; score: number }>();
  for (const item of semantic as Array<{ object: any; score: number }>) {
    merged.set(item.object._id.toString(), { object: item.object, score: item.score + 0.5 });
  }
  for (const object of text) {
    const id = object._id.toString();
    const existing = merged.get(id);
    merged.set(id, { object, score: (existing?.score ?? 0) + 0.5 });
  }
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
