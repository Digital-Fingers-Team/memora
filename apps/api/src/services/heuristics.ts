import type { HarvestResult } from "@memora/shared";

export function heuristicHarvest(rawContent: string, fallbackTitle: string): HarvestResult {
  const sentences = rawContent
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const words = rawContent.toLowerCase().match(/[a-z0-9][a-z0-9-]{3,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  return {
    title: fallbackTitle || sentences[0]?.slice(0, 140) || "Untitled knowledge",
    structuredSummary: sentences.slice(0, 3).join(" ") || rawContent.slice(0, 500),
    keyInsights: sentences.slice(0, 5),
    principles: [],
    decisions: sentences.filter((sentence) => /decid|chose|choice|will/i.test(sentence)).slice(0, 5),
    lessons: sentences.filter((sentence) => /learn|lesson|mistake/i.test(sentence)).slice(0, 5),
    frameworks: [],
    opportunities: sentences.filter((sentence) => /opportun|could|market|growth/i.test(sentence)).slice(0, 5),
    risks: sentences.filter((sentence) => /risk|problem|fail|concern/i.test(sentence)).slice(0, 5),
    questions: sentences.filter((sentence) => sentence.endsWith("?")).slice(0, 5),
    tags,
    categories: tags.slice(0, 3),
    confidenceScore: 0.55,
    suggestedRelationships: []
  };
}
