import { env } from "../config";
import { Settings } from "../models";

export async function getEffectiveSettings(ownerId?: string) {
  const [adminSettings, userSettings] = await Promise.all([
    Settings.findOne({ scope: "admin" }),
    ownerId ? Settings.findOne({ scope: "user", ownerId }) : null
  ]);

  return {
    model: userSettings?.model ?? adminSettings?.model ?? env.OPENROUTER_DEFAULT_MODEL,
    temperature: userSettings?.temperature ?? adminSettings?.temperature ?? 0.2,
    maxTokens: userSettings?.maxTokens ?? adminSettings?.maxTokens ?? 4000,
    embeddingModel: userSettings?.embeddingModel ?? adminSettings?.embeddingModel ?? env.EMBEDDING_MODEL,
    embeddingDimensions: userSettings?.embeddingDimensions ?? adminSettings?.embeddingDimensions ?? env.EMBEDDING_DIMENSIONS,
    theme: userSettings?.theme ?? "system"
  };
}

export async function upsertUserSettings(ownerId: string, input: Record<string, unknown>) {
  const current = await getEffectiveSettings(ownerId);
  return Settings.findOneAndUpdate(
    { scope: "user", ownerId },
    { $set: { ...current, ...input, scope: "user", ownerId } },
    { new: true, upsert: true }
  );
}

export async function upsertAdminSettings(input: Record<string, unknown>) {
  const current = await getEffectiveSettings();
  return Settings.findOneAndUpdate(
    { scope: "admin" },
    { $set: { ...current, ...input, scope: "admin" } },
    { new: true, upsert: true }
  );
}
