import { z } from "zod";

export const objectIdSchema = z.string().min(1);

export const userRoleSchema = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const knowledgeSourceTypeSchema = z.enum([
  "text",
  "voice",
  "url",
  "image",
  "file",
  "chat",
  "project",
  "decision",
  "lesson",
  "idea"
]);
export type KnowledgeSourceType = z.infer<typeof knowledgeSourceTypeSchema>;

export const knowledgeStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);
export type KnowledgeStatus = z.infer<typeof knowledgeStatusSchema>;

export const relationshipTypeSchema = z.enum([
  "similar_concept",
  "shared_topic",
  "shared_project",
  "shared_person",
  "shared_decision",
  "contradiction",
  "supports",
  "derived_from",
  "revisits"
]);
export type RelationshipType = z.infer<typeof relationshipTypeSchema>;

export const jobTypeSchema = z.enum([
  "harvest",
  "embedding",
  "relationship_detection",
  "pattern_analysis",
  "weekly_report",
  "decision_review"
]);
export type JobType = z.infer<typeof jobTypeSchema>;

export const jobStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const reportTypeSchema = z.enum(["weekly", "pattern", "decision_review"]);
export type ReportType = z.infer<typeof reportTypeSchema>;

const optionalTrimmedString = (schema: z.ZodString) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }, schema.optional());

export const captureInputSchema = z.object({
  type: knowledgeSourceTypeSchema,
  title: optionalTrimmedString(z.string().min(1).max(180)),
  content: z.string().trim().min(1).max(200000),
  sourceUrl: optionalTrimmedString(z.string().url()),
  metadata: z.record(z.unknown()).optional()
});
export type CaptureInput = z.infer<typeof captureInputSchema>;

export const harvestResultSchema = z.object({
  title: z.string().min(1).max(180),
  structuredSummary: z.string().min(1),
  keyInsights: z.array(z.string()).default([]),
  principles: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  lessons: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1),
  suggestedRelationships: z
    .array(
      z.object({
        targetTitle: z.string(),
        type: relationshipTypeSchema,
        strength: z.number().min(0).max(1),
        explanation: z.string()
      })
    )
    .default([])
});
export type HarvestResult = z.infer<typeof harvestResultSchema>;

export const knowledgeObjectSchema = z.object({
  id: objectIdSchema,
  ownerId: objectIdSchema,
  title: z.string(),
  rawContent: z.string(),
  structuredSummary: z.string().optional(),
  keyInsights: z.array(z.string()).default([]),
  principles: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  lessons: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  relationships: z.array(objectIdSchema).default([]),
  source: z.object({
    type: knowledgeSourceTypeSchema,
    url: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  }),
  confidenceScore: z.number().min(0).max(1).default(0),
  status: knowledgeStatusSchema,
  lastReferencedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type KnowledgeObjectDto = z.infer<typeof knowledgeObjectSchema>;

export const decisionInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  context: z.string().trim().min(1),
  optionsConsidered: z.array(z.string().trim().min(1)).min(1),
  reasoning: z.string().trim().min(1),
  finalChoice: z.string().trim().min(1),
  expectedOutcome: z.string().trim().min(1),
  reviewDate: z.string().datetime().optional(),
  linkedKnowledgeObjectIds: z.array(objectIdSchema).default([])
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;

export const decisionReviewInputSchema = z.object({
  actualOutcome: z.string().trim().min(1)
});
export type DecisionReviewInput = z.infer<typeof decisionReviewInputSchema>;

export const assistantChatInputSchema = z.object({
  conversationId: objectIdSchema.optional(),
  message: z.string().trim().min(1).max(20000)
});
export type AssistantChatInput = z.infer<typeof assistantChatInputSchema>;

export const settingsInputSchema = z.object({
  model: z.string().trim().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(128).max(32000).optional(),
  embeddingModel: z.string().trim().min(1).optional(),
  embeddingDimensions: z.number().int().min(64).max(4096).optional(),
  theme: z.enum(["light", "dark", "system"]).optional()
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const semanticSearchInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).default(10)
});
export type SemanticSearchInput = z.infer<typeof semanticSearchInputSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional()
  })
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export type ApiResult<T> = { data: T };
