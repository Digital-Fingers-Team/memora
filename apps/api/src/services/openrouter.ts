import { env } from "../config";
import { AppError } from "../errors";
import { getEffectiveSettings } from "./settings";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function completeWithOpenRouter(ownerId: string | undefined, messages: Message[], json = false) {
  const settings = await getEffectiveSettings(ownerId);

  if (!env.OPENROUTER_API_KEY) {
    throw new AppError(503, "OpenRouter API key is not configured", "AI_NOT_CONFIGURED");
  }

  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.APP_URL,
      "X-Title": "Knowledge Harvest"
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      response_format: json ? { type: "json_object" } : undefined
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(response.status, "OpenRouter request failed", "OPENROUTER_ERROR", body.slice(0, 1000));
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function embedWithOpenRouter(input: string, ownerId?: string) {
  const settings = await getEffectiveSettings(ownerId);

  if (!env.OPENROUTER_API_KEY) {
    return deterministicEmbedding(input, settings.embeddingDimensions);
  }

  const response = await fetch(`${env.OPENROUTER_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.APP_URL,
      "X-Title": "Knowledge Harvest"
    },
    body: JSON.stringify({
      model: settings.embeddingModel,
      input
    })
  });

  if (!response.ok) return deterministicEmbedding(input, settings.embeddingDimensions);

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const vector = payload.data?.[0]?.embedding;
  return vector?.length ? vector : deterministicEmbedding(input, settings.embeddingDimensions);
}

export function deterministicEmbedding(input: string, dimensions: number) {
  const vector = new Array(dimensions).fill(0);
  const text = input.toLowerCase();
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    vector[(code + i) % dimensions] += ((code % 17) + 1) / 17;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}
