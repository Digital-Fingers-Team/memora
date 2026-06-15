import mongoose, { Schema, Types } from "mongoose";
import type { JobStatus, JobType, KnowledgeSourceType, KnowledgeStatus, RelationshipType, ReportType, UserRole } from "@memora/shared";

const timestamps = { timestamps: true };

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash?: string;
  googleId?: string;
  name?: string;
  role: UserRole;
  preferences: { theme: "light" | "dark" | "system" };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: String,
    googleId: { type: String, index: true },
    name: String,
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" }
    }
  },
  timestamps
);

export interface SettingsDoc {
  _id: Types.ObjectId;
  ownerId?: Types.ObjectId;
  scope: "user" | "admin";
  model: string;
  temperature: number;
  maxTokens: number;
  embeddingModel: string;
  embeddingDimensions: number;
  theme?: "light" | "dark" | "system";
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    scope: { type: String, enum: ["user", "admin"], required: true, index: true },
    model: { type: String, required: true },
    temperature: { type: Number, default: 0.2 },
    maxTokens: { type: Number, default: 4000 },
    embeddingModel: { type: String, required: true },
    embeddingDimensions: { type: Number, required: true },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" }
  },
  timestamps
);
settingsSchema.index({ ownerId: 1, scope: 1 }, { unique: true, partialFilterExpression: { scope: "user" } });
settingsSchema.index({ scope: 1 }, { unique: true, partialFilterExpression: { scope: "admin" } });

export interface KnowledgeObjectDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  rawContent: string;
  structuredSummary?: string;
  keyInsights: string[];
  principles: string[];
  decisions: string[];
  lessons: string[];
  frameworks: string[];
  opportunities: string[];
  risks: string[];
  questions: string[];
  tags: string[];
  categories: string[];
  relationships: Types.ObjectId[];
  source: { type: KnowledgeSourceType; url?: string; metadata?: Record<string, unknown> };
  confidenceScore: number;
  status: KnowledgeStatus;
  processingError?: string;
  lastReferencedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeObjectSchema = new Schema<KnowledgeObjectDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, text: true },
    rawContent: { type: String, required: true, text: true },
    structuredSummary: { type: String, text: true },
    keyInsights: [{ type: String, text: true }],
    principles: [String],
    decisions: [String],
    lessons: [String],
    frameworks: [String],
    opportunities: [String],
    risks: [String],
    questions: [String],
    tags: [{ type: String, index: true }],
    categories: [{ type: String, index: true }],
    relationships: [{ type: Schema.Types.ObjectId, ref: "Relationship" }],
    source: {
      type: { type: String, enum: ["text", "voice", "url", "image", "file", "chat", "project", "decision", "lesson", "idea"], required: true },
      url: String,
      metadata: Schema.Types.Mixed
    },
    confidenceScore: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "processing", "ready", "failed"], default: "pending", index: true },
    processingError: String,
    lastReferencedAt: Date
  },
  timestamps
);
knowledgeObjectSchema.index({ ownerId: 1, createdAt: -1 });
knowledgeObjectSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
knowledgeObjectSchema.index({ title: "text", rawContent: "text", structuredSummary: "text", keyInsights: "text", tags: "text" });

export interface RelationshipDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  sourceObjectId: Types.ObjectId;
  targetObjectId: Types.ObjectId;
  type: RelationshipType;
  strength: number;
  explanation: string;
  detectionSource: "ai" | "semantic" | "manual" | "rules";
  createdAt: Date;
  updatedAt: Date;
}

const relationshipSchema = new Schema<RelationshipDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceObjectId: { type: Schema.Types.ObjectId, ref: "KnowledgeObject", required: true, index: true },
    targetObjectId: { type: Schema.Types.ObjectId, ref: "KnowledgeObject", required: true, index: true },
    type: { type: String, required: true },
    strength: { type: Number, min: 0, max: 1, required: true },
    explanation: { type: String, required: true },
    detectionSource: { type: String, enum: ["ai", "semantic", "manual", "rules"], default: "rules" }
  },
  timestamps
);
relationshipSchema.index({ ownerId: 1, sourceObjectId: 1, targetObjectId: 1, type: 1 }, { unique: true });

export interface DecisionDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  context: string;
  optionsConsidered: string[];
  reasoning: string;
  finalChoice: string;
  expectedOutcome: string;
  actualOutcome?: string;
  learningReport?: string;
  reviewDate?: Date;
  linkedKnowledgeObjectIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const decisionSchema = new Schema<DecisionDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, text: true },
    context: { type: String, required: true, text: true },
    optionsConsidered: [String],
    reasoning: { type: String, required: true },
    finalChoice: { type: String, required: true },
    expectedOutcome: { type: String, required: true },
    actualOutcome: String,
    learningReport: String,
    reviewDate: { type: Date, index: true },
    linkedKnowledgeObjectIds: [{ type: Schema.Types.ObjectId, ref: "KnowledgeObject" }]
  },
  timestamps
);
decisionSchema.index({ ownerId: 1, createdAt: -1 });

export interface ReportDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  type: ReportType;
  title: string;
  summary: string;
  insights: string[];
  themes: string[];
  forgottenKnowledge: string[];
  connections: string[];
  recommendations: string[];
  linkedKnowledgeObjectIds: Types.ObjectId[];
  createdAt: Date;
}

const reportSchema = new Schema<ReportDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["weekly", "pattern", "decision_review"], required: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    insights: [String],
    themes: [String],
    forgottenKnowledge: [String],
    connections: [String],
    recommendations: [String],
    linkedKnowledgeObjectIds: [{ type: Schema.Types.ObjectId, ref: "KnowledgeObject" }]
  },
  timestamps
);
reportSchema.index({ ownerId: 1, type: 1, createdAt: -1 });

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    citations: [{ knowledgeObjectId: Schema.Types.ObjectId, title: String, quote: String }],
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    messages: [messageSchema],
    retrievedContext: [Schema.Types.Mixed]
  },
  timestamps
);
conversationSchema.index({ ownerId: 1, updatedAt: -1 });

const embeddingSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refType: { type: String, enum: ["knowledgeObject", "message", "report"], required: true },
    refId: { type: Schema.Types.ObjectId, required: true, index: true },
    vector: { type: [Number], required: true },
    contentHash: { type: String, required: true, index: true },
    provider: String,
    model: String,
    dimensions: Number
  },
  timestamps
);
embeddingSchema.index({ ownerId: 1, refType: 1, refId: 1 }, { unique: true });

export interface JobDoc {
  _id: Types.ObjectId;
  type: JobType;
  status: JobStatus;
  ownerId: Types.ObjectId;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lockOwner?: string;
  lockedAt?: Date;
  scheduledFor: Date;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<JobDoc>(
  {
    type: { type: String, required: true, index: true },
    status: { type: String, enum: ["queued", "running", "succeeded", "failed", "cancelled"], default: "queued", index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lockOwner: String,
    lockedAt: Date,
    scheduledFor: { type: Date, default: Date.now, index: true },
    result: Schema.Types.Mixed,
    error: String
  },
  timestamps
);
jobSchema.index({ status: 1, scheduledFor: 1, lockedAt: 1 });

export const User = mongoose.model("User", userSchema);
export const Settings = mongoose.model("Settings", settingsSchema);
export const KnowledgeObject = mongoose.model("KnowledgeObject", knowledgeObjectSchema);
export const Relationship = mongoose.model("Relationship", relationshipSchema);
export const Decision = mongoose.model("Decision", decisionSchema);
export const Report = mongoose.model("Report", reportSchema);
export const Conversation = mongoose.model("Conversation", conversationSchema);
export const Embedding = mongoose.model("Embedding", embeddingSchema);
export const Job = mongoose.model<JobDoc>("Job", jobSchema);
