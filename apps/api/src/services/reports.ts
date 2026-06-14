import { Decision, KnowledgeObject, Report } from "../models";
import { completeWithOpenRouter } from "./openrouter";

export async function generateWeeklyReport(ownerId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const objects = await KnowledgeObject.find({ ownerId, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(100);
  const topTags = countTop(objects.flatMap((object) => object.tags), 8);
  const linkedIds = objects.map((object) => object._id);
  const context = objects.map((object) => `- ${object.title}: ${object.structuredSummary ?? object.rawContent.slice(0, 240)}`).join("\n");

  let summary = `You captured ${objects.length} knowledge objects this week. Emerging themes: ${topTags.join(", ") || "not enough data yet"}.`;
  let recommendations = topTags.slice(0, 4).map((tag) => `Explore how ${tag} connects to current decisions.`);

  try {
    const ai = await completeWithOpenRouter(ownerId, [
      { role: "system", content: "Write a concise weekly intelligence report from the user's personal knowledge." },
      { role: "user", content: context || "No new objects this week." }
    ]);
    summary = ai;
  } catch {
    // Keep deterministic report when AI is unavailable.
  }

  return Report.create({
    ownerId,
    type: "weekly",
    title: `Weekly Intelligence Report - ${new Date().toISOString().slice(0, 10)}`,
    summary,
    insights: objects.flatMap((object) => object.keyInsights).slice(0, 10),
    themes: topTags,
    forgottenKnowledge: [],
    connections: [],
    recommendations,
    linkedKnowledgeObjectIds: linkedIds
  });
}

export async function analyzePatterns(ownerId: string) {
  const objects = await KnowledgeObject.find({ ownerId }).sort({ updatedAt: -1 }).limit(500);
  const tags = countTop(objects.flatMap((object) => object.tags), 10);
  const questions = objects.flatMap((object) => object.questions).slice(0, 10);
  const decisions = await Decision.find({ ownerId }).sort({ createdAt: -1 }).limit(50);

  return Report.create({
    ownerId,
    type: "pattern",
    title: `Pattern Report - ${new Date().toISOString().slice(0, 10)}`,
    summary: `Repeated themes include ${tags.join(", ") || "not enough data yet"}. You have ${decisions.length} recorded decisions available for future outcome comparison.`,
    insights: [
      ...tags.map((tag) => `You repeatedly return to ${tag}.`),
      ...questions.map((question) => `Open question: ${question}`)
    ].slice(0, 12),
    themes: tags,
    forgottenKnowledge: objects
      .filter((object) => object.lastReferencedAt && object.lastReferencedAt < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
      .slice(0, 8)
      .map((object) => object.title),
    connections: [],
    recommendations: tags.slice(0, 4).map((tag) => `Review older objects tagged ${tag} before making related decisions.`),
    linkedKnowledgeObjectIds: objects.slice(0, 30).map((object) => object._id)
  });
}

function countTop(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}
