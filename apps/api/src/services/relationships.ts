import { KnowledgeObject, Relationship } from "../models";

export async function detectRelationships(ownerId: string, knowledgeObjectId: string) {
  const source = await KnowledgeObject.findOne({ _id: knowledgeObjectId, ownerId });
  if (!source) return [];

  const candidates = await KnowledgeObject.find({
    ownerId,
    _id: { $ne: source._id },
    $or: [{ tags: { $in: source.tags } }, { categories: { $in: source.categories } }]
  }).limit(25);

  const relationships = [];
  for (const target of candidates) {
    const sharedTags = target.tags.filter((tag) => source.tags.includes(tag));
    const sharedCategories = target.categories.filter((category) => source.categories.includes(category));
    const strength = Math.min(1, (sharedTags.length * 0.15 + sharedCategories.length * 0.25) || 0.2);
    const relationship = await Relationship.findOneAndUpdate(
      {
        ownerId,
        sourceObjectId: source._id,
        targetObjectId: target._id,
        type: sharedCategories.length ? "shared_topic" : "similar_concept"
      },
      {
        $set: {
          ownerId,
          sourceObjectId: source._id,
          targetObjectId: target._id,
          type: sharedCategories.length ? "shared_topic" : "similar_concept",
          strength,
          explanation: `Shared ${[...sharedTags, ...sharedCategories].join(", ") || "semantic context"}.`,
          detectionSource: "rules"
        }
      },
      { new: true, upsert: true }
    );
    relationships.push(relationship);
  }

  await KnowledgeObject.updateOne({ _id: source._id }, { $addToSet: { relationships: { $each: relationships.map((item) => item._id) } } });
  return relationships;
}
