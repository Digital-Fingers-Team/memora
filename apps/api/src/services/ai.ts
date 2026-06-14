import { harvestResultSchema, type HarvestResult } from "@knowledge-harvest/shared";
import { completeWithOpenRouter } from "./openrouter";
import { heuristicHarvest } from "./heuristics";

export async function harvestKnowledge(ownerId: string, rawContent: string, fallbackTitle: string): Promise<HarvestResult> {
  try {
    const content = await completeWithOpenRouter(
      ownerId,
      [
        {
          role: "system",
          content:
            "You extract personal knowledge into durable structured JSON. Return only valid JSON with title, structuredSummary, keyInsights, principles, decisions, lessons, frameworks, opportunities, risks, questions, tags, categories, confidenceScore, suggestedRelationships."
        },
        {
          role: "user",
          content: `Harvest this content into a Knowledge Harvest object:\n\n${rawContent.slice(0, 50000)}`
        }
      ],
      true
    );
    return harvestResultSchema.parse(JSON.parse(content));
  } catch {
    return heuristicHarvest(rawContent, fallbackTitle);
  }
}

export async function generateAssistantAnswer(ownerId: string, question: string, context: string) {
  try {
    return await completeWithOpenRouter(ownerId, [
      {
        role: "system",
        content:
          "You are Knowledge Harvest's thinking assistant. Answer from the user's personal knowledge first. Cite object titles naturally. If personal context is thin, say so and then reason generally."
      },
      {
        role: "user",
        content: `Personal knowledge context:\n${context || "No strong matches found."}\n\nUser question:\n${question}`
      }
    ]);
  } catch {
    if (!context) return "I could not find strong personal knowledge matches yet. Based on the question alone, capture more related notes and decisions so I can compound this over time.";
    return `From your saved knowledge, the strongest relevant context is:\n\n${context.slice(0, 1800)}`;
  }
}

export async function generateDecisionReview(ownerId: string, decision: {
  title: string;
  context: string;
  reasoning: string;
  expectedOutcome: string;
  actualOutcome: string;
}) {
  try {
    return await completeWithOpenRouter(ownerId, [
      { role: "system", content: "Compare expected vs actual outcomes and produce a concise learning report." },
      { role: "user", content: JSON.stringify(decision) }
    ]);
  } catch {
    return `Decision review for ${decision.title}: expected "${decision.expectedOutcome}", actual "${decision.actualOutcome}". Revisit the assumptions in the original reasoning and capture any repeatable lesson.`;
  }
}
