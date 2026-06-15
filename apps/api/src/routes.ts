import { OAuth2Client } from "google-auth-library";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  assistantChatInputSchema,
  captureInputSchema,
  decisionInputSchema,
  decisionReviewInputSchema,
  relationshipTypeSchema,
  semanticSearchInputSchema,
  settingsInputSchema
} from "@memora/shared";
import { env } from "./config";
import { AppError } from "./errors";
import { ensureFirstAdmin, hashPassword, requireAdmin, requireAuth, signTokens, verifyPassword } from "./auth";
import { Conversation, Decision, Job, KnowledgeObject, Relationship, Report, User } from "./models";
import { serializeDoc, serializeMany } from "./serialize";
import { enqueueJob } from "./services/jobs";
import { harvestKnowledge, generateAssistantAnswer, generateDecisionReview } from "./services/ai";
import { embedKnowledgeObject } from "./services/embedding";
import { semanticSearch, hybridSearch } from "./services/search";
import { detectRelationships } from "./services/relationships";
import { analyzePatterns, generateWeeklyReport } from "./services/reports";
import { getEffectiveSettings, upsertAdminSettings, upsertUserSettings } from "./services/settings";

export const api = express.Router();

const passwordSchema = z.string().min(8).max(128);
const authSchema = z.object({ email: z.string().email(), password: passwordSchema, name: z.string().optional() });
const googleSchema = z.object({ idToken: z.string().min(1) });
const idParamSchema = z.object({ id: z.string().min(1) });
const relationshipInputSchema = z.object({
  sourceObjectId: z.string().min(1),
  targetObjectId: z.string().min(1),
  type: relationshipTypeSchema,
  strength: z.number().min(0).max(1),
  explanation: z.string().min(1)
});

function ownerId(req: express.Request) {
  if (!req.user) throw new AppError(401, "Authentication required", "AUTH_REQUIRED");
  return req.user.id;
}

api.get("/health", (_req, res) => {
  res.json({ data: { ok: true, service: "memora-api", time: new Date().toISOString() } });
});

api.get("/docs", (_req, res) => {
  res.json({
    data: {
      version: "v1",
      resources: ["auth", "inbox", "knowledge", "ai", "search", "assistant", "graph", "relationships", "decisions", "reports", "patterns", "settings", "admin"],
      note: "See docs/api.md for endpoint details."
    }
  });
});

api.post("/auth/register", async (req, res, next) => {
  try {
    const input = authSchema.parse(req.body);
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) throw new AppError(409, "Email is already registered", "EMAIL_EXISTS");
    const user = await User.create({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: await ensureFirstAdmin(input.email)
    });
    res.status(201).json({ data: signTokens(user) });
  } catch (error) {
    next(error);
  }
});

api.post("/auth/login", async (req, res, next) => {
  try {
    const input = authSchema.pick({ email: true, password: true }).parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    res.json({ data: signTokens(user) });
  } catch (error) {
    next(error);
  }
});

api.post("/auth/google", async (req, res, next) => {
  try {
    const input = googleSchema.parse(req.body);
    if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, "Google login is not configured", "GOOGLE_NOT_CONFIGURED");
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: input.idToken, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new AppError(401, "Google token did not include an email", "INVALID_GOOGLE_TOKEN");
    const user = await User.findOneAndUpdate(
      { email: payload.email.toLowerCase() },
      {
        $setOnInsert: { role: await ensureFirstAdmin(payload.email) },
        $set: { googleId: payload.sub, name: payload.name, email: payload.email.toLowerCase() }
      },
      { new: true, upsert: true }
    );
    res.json({ data: signTokens(user) });
  } catch (error) {
    next(error);
  }
});

api.post("/auth/refresh", async (req, res, next) => {
  try {
    const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    res.json({ data: signTokens(user) });
  } catch (error) {
    next(new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN"));
  }
});

api.post("/auth/logout", requireAuth, (_req, res) => {
  res.json({ data: { ok: true } });
});

api.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(ownerId(req));
    if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
    res.json({ data: serializeDoc(user) });
  } catch (error) {
    next(error);
  }
});

api.post("/inbox/capture", requireAuth, async (req, res, next) => {
  try {
    const input = captureInputSchema.parse(req.body);
    const object = await KnowledgeObject.create({
      ownerId: ownerId(req),
      title: input.title ?? input.content.slice(0, 90) ?? "Untitled knowledge",
      rawContent: input.content,
      source: { type: input.type, url: input.sourceUrl, metadata: input.metadata },
      status: "pending"
    });
    await enqueueJob(ownerId(req), "harvest", { knowledgeObjectId: object._id.toString() });
    res.status(201).json({ data: serializeDoc(object) });
  } catch (error) {
    next(error);
  }
});

api.get("/knowledge", requireAuth, async (req, res, next) => {
  try {
    const query = z
      .object({
        q: z.string().optional(),
        status: z.string().optional(),
        tag: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).default(30)
      })
      .parse(req.query);
    const filter: Record<string, unknown> = { ownerId: ownerId(req) };
    if (query.status) filter.status = query.status;
    if (query.tag) filter.tags = query.tag;
    if (query.q) filter.$text = { $search: query.q };
    const objects = await KnowledgeObject.find(filter).sort({ updatedAt: -1 }).limit(query.limit);
    res.json({ data: serializeMany(objects) });
  } catch (error) {
    next(error);
  }
});

api.post("/knowledge", requireAuth, async (req, res, next) => {
  try {
    const input = captureInputSchema.extend({ title: z.string().min(1).max(180) }).parse(req.body);
    const object = await KnowledgeObject.create({
      ownerId: ownerId(req),
      title: input.title,
      rawContent: input.content,
      source: { type: input.type, url: input.sourceUrl, metadata: input.metadata },
      status: "pending"
    });
    await enqueueJob(ownerId(req), "harvest", { knowledgeObjectId: object._id.toString() });
    res.status(201).json({ data: serializeDoc(object) });
  } catch (error) {
    next(error);
  }
});

api.get("/knowledge/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const object = await KnowledgeObject.findOneAndUpdate({ _id: id, ownerId: ownerId(req) }, { $set: { lastReferencedAt: new Date() } }, { new: true });
    if (!object) throw new AppError(404, "Knowledge object not found", "KNOWLEDGE_NOT_FOUND");
    res.json({ data: serializeDoc(object) });
  } catch (error) {
    next(error);
  }
});

api.patch("/knowledge/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = z
      .object({
        title: z.string().min(1).max(180).optional(),
        rawContent: z.string().min(1).optional(),
        structuredSummary: z.string().optional(),
        keyInsights: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional()
      })
      .parse(req.body);
    const object = await KnowledgeObject.findOneAndUpdate({ _id: id, ownerId: ownerId(req) }, { $set: patch }, { new: true });
    if (!object) throw new AppError(404, "Knowledge object not found", "KNOWLEDGE_NOT_FOUND");
    await enqueueJob(ownerId(req), "embedding", { knowledgeObjectId: id });
    res.json({ data: serializeDoc(object) });
  } catch (error) {
    next(error);
  }
});

api.delete("/knowledge/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await KnowledgeObject.deleteOne({ _id: id, ownerId: ownerId(req) });
    await Relationship.deleteMany({ ownerId: ownerId(req), $or: [{ sourceObjectId: id }, { targetObjectId: id }] });
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});

api.post("/knowledge/:id/reprocess", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const object = await KnowledgeObject.findOneAndUpdate({ _id: id, ownerId: ownerId(req) }, { $set: { status: "pending" } }, { new: true });
    if (!object) throw new AppError(404, "Knowledge object not found", "KNOWLEDGE_NOT_FOUND");
    await enqueueJob(ownerId(req), "harvest", { knowledgeObjectId: id });
    res.json({ data: serializeDoc(object) });
  } catch (error) {
    next(error);
  }
});

api.post("/ai/harvest/:knowledgeObjectId", requireAuth, async (req, res, next) => {
  try {
    const id = z.object({ knowledgeObjectId: z.string() }).parse(req.params).knowledgeObjectId;
    const object = await KnowledgeObject.findOne({ _id: id, ownerId: ownerId(req) });
    if (!object) throw new AppError(404, "Knowledge object not found", "KNOWLEDGE_NOT_FOUND");
    const result = await harvestKnowledge(ownerId(req), object.rawContent, object.title);
    Object.assign(object, { ...result, status: "ready" });
    await object.save();
    await embedKnowledgeObject(ownerId(req), id);
    res.json({ data: serializeDoc(object) });
  } catch (error) {
    next(error);
  }
});

api.post("/search/semantic", requireAuth, async (req, res, next) => {
  try {
    const input = semanticSearchInputSchema.parse(req.body);
    const results = await semanticSearch(ownerId(req), input.query, input.limit);
    res.json({ data: results.map((item: any) => ({ object: serializeDoc(item.object), score: item.score })) });
  } catch (error) {
    next(error);
  }
});

api.post("/search/hybrid", requireAuth, async (req, res, next) => {
  try {
    const input = semanticSearchInputSchema.parse(req.body);
    const results = await hybridSearch(ownerId(req), input.query, input.limit);
    res.json({ data: results.map((item: any) => ({ object: serializeDoc(item.object), score: item.score })) });
  } catch (error) {
    next(error);
  }
});

api.post("/assistant/chat", requireAuth, async (req, res, next) => {
  try {
    const input = assistantChatInputSchema.parse(req.body);
    const matches = await hybridSearch(ownerId(req), input.message, 6);
    const context = matches.map((item: any) => `${item.object.title}: ${item.object.structuredSummary ?? item.object.rawContent.slice(0, 400)}`).join("\n");
    const answer = await generateAssistantAnswer(ownerId(req), input.message, context);
    const citations = matches.map((item: any) => ({
      knowledgeObjectId: item.object._id,
      title: item.object.title,
      quote: item.object.structuredSummary ?? item.object.rawContent.slice(0, 160)
    }));
    let conversation;
    if (input.conversationId) {
      conversation = await Conversation.findOneAndUpdate(
        { _id: input.conversationId, ownerId: ownerId(req) },
        {
          $push: {
            messages: [
              { role: "user", content: input.message },
              { role: "assistant", content: answer, citations }
            ]
          },
          $set: { retrievedContext: matches.map((item: any) => ({ id: item.object._id, score: item.score })) }
        },
        { new: true }
      );
      if (!conversation) throw new AppError(404, "Conversation not found", "CONVERSATION_NOT_FOUND");
    } else {
      conversation = await Conversation.create({
        ownerId: ownerId(req),
        title: input.message.slice(0, 80),
        messages: [
          { role: "user", content: input.message },
          { role: "assistant", content: answer, citations }
        ],
        retrievedContext: matches.map((item: any) => ({ id: item.object._id, score: item.score }))
      });
    }
    res.json({ data: serializeDoc(conversation) });
  } catch (error) {
    next(error);
  }
});

api.get("/assistant/conversations", requireAuth, async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ ownerId: ownerId(req) }).sort({ updatedAt: -1 }).limit(30);
    res.json({ data: serializeMany(conversations) });
  } catch (error) {
    next(error);
  }
});

api.get("/assistant/conversations/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const conversation = await Conversation.findOne({ _id: id, ownerId: ownerId(req) });
    if (!conversation) throw new AppError(404, "Conversation not found", "CONVERSATION_NOT_FOUND");
    res.json({ data: serializeDoc(conversation) });
  } catch (error) {
    next(error);
  }
});

api.get("/graph", requireAuth, async (req, res, next) => {
  try {
    const [objects, relationships] = await Promise.all([
      KnowledgeObject.find({ ownerId: ownerId(req) }).sort({ updatedAt: -1 }).limit(100),
      Relationship.find({ ownerId: ownerId(req) }).sort({ strength: -1 }).limit(250)
    ]);
    res.json({
      data: {
        nodes: objects.map((object) => ({ id: object._id.toString(), title: object.title, tags: object.tags, status: object.status })),
        edges: relationships.map((rel) => ({
          id: rel._id.toString(),
          source: rel.sourceObjectId.toString(),
          target: rel.targetObjectId.toString(),
          type: rel.type,
          strength: rel.strength,
          explanation: rel.explanation
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

api.get("/graph/object/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const object = await KnowledgeObject.findOne({ _id: id, ownerId: ownerId(req) });
    if (!object) throw new AppError(404, "Knowledge object not found", "KNOWLEDGE_NOT_FOUND");
    const relationships = await Relationship.find({ ownerId: ownerId(req), $or: [{ sourceObjectId: id }, { targetObjectId: id }] });
    res.json({ data: { object: serializeDoc(object), relationships: serializeMany(relationships) } });
  } catch (error) {
    next(error);
  }
});

api.post("/relationships", requireAuth, async (req, res, next) => {
  try {
    const input = relationshipInputSchema.parse(req.body);
    const relationship = await Relationship.create({ ownerId: ownerId(req), ...input, detectionSource: "manual" });
    res.status(201).json({ data: serializeDoc(relationship) });
  } catch (error) {
    next(error);
  }
});

api.patch("/relationships/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = relationshipInputSchema.partial().parse(req.body);
    const relationship = await Relationship.findOneAndUpdate({ _id: id, ownerId: ownerId(req) }, { $set: patch }, { new: true });
    if (!relationship) throw new AppError(404, "Relationship not found", "RELATIONSHIP_NOT_FOUND");
    res.json({ data: serializeDoc(relationship) });
  } catch (error) {
    next(error);
  }
});

api.delete("/relationships/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await Relationship.deleteOne({ _id: id, ownerId: ownerId(req) });
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});

api.get("/decisions", requireAuth, async (req, res, next) => {
  try {
    const decisions = await Decision.find({ ownerId: ownerId(req) }).sort({ createdAt: -1 }).limit(100);
    res.json({ data: serializeMany(decisions) });
  } catch (error) {
    next(error);
  }
});

api.post("/decisions", requireAuth, async (req, res, next) => {
  try {
    const input = decisionInputSchema.parse(req.body);
    const decision = await Decision.create({ ownerId: ownerId(req), ...input });
    const object = await KnowledgeObject.create({
      ownerId: ownerId(req),
      title: `Decision: ${decision.title}`,
      rawContent: [decision.context, decision.reasoning, decision.finalChoice, decision.expectedOutcome].join("\n\n"),
      source: { type: "decision", metadata: { decisionId: decision._id.toString() } },
      status: "pending"
    });
    await enqueueJob(ownerId(req), "harvest", { knowledgeObjectId: object._id.toString() });
    res.status(201).json({ data: serializeDoc(decision) });
  } catch (error) {
    next(error);
  }
});

api.get("/decisions/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const decision = await Decision.findOne({ _id: id, ownerId: ownerId(req) });
    if (!decision) throw new AppError(404, "Decision not found", "DECISION_NOT_FOUND");
    res.json({ data: serializeDoc(decision) });
  } catch (error) {
    next(error);
  }
});

api.patch("/decisions/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = decisionInputSchema.partial().parse(req.body);
    const decision = await Decision.findOneAndUpdate({ _id: id, ownerId: ownerId(req) }, { $set: patch }, { new: true });
    if (!decision) throw new AppError(404, "Decision not found", "DECISION_NOT_FOUND");
    res.json({ data: serializeDoc(decision) });
  } catch (error) {
    next(error);
  }
});

api.post("/decisions/:id/review", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = decisionReviewInputSchema.parse(req.body);
    const decision = await Decision.findOne({ _id: id, ownerId: ownerId(req) });
    if (!decision) throw new AppError(404, "Decision not found", "DECISION_NOT_FOUND");
    decision.actualOutcome = input.actualOutcome;
    decision.learningReport = await generateDecisionReview(ownerId(req), {
      title: decision.title,
      context: decision.context,
      reasoning: decision.reasoning,
      expectedOutcome: decision.expectedOutcome,
      actualOutcome: input.actualOutcome
    });
    await decision.save();
    res.json({ data: serializeDoc(decision) });
  } catch (error) {
    next(error);
  }
});

api.get("/reports", requireAuth, async (req, res, next) => {
  try {
    const reports = await Report.find({ ownerId: ownerId(req) }).sort({ createdAt: -1 }).limit(50);
    res.json({ data: serializeMany(reports) });
  } catch (error) {
    next(error);
  }
});

api.get("/reports/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const report = await Report.findOne({ _id: id, ownerId: ownerId(req) });
    if (!report) throw new AppError(404, "Report not found", "REPORT_NOT_FOUND");
    res.json({ data: serializeDoc(report) });
  } catch (error) {
    next(error);
  }
});

api.post("/reports/generate-weekly", requireAuth, async (req, res, next) => {
  try {
    const report = await generateWeeklyReport(ownerId(req));
    res.status(201).json({ data: serializeDoc(report) });
  } catch (error) {
    next(error);
  }
});

api.get("/patterns", requireAuth, async (req, res, next) => {
  try {
    const reports = await Report.find({ ownerId: ownerId(req), type: "pattern" }).sort({ createdAt: -1 }).limit(20);
    res.json({ data: serializeMany(reports) });
  } catch (error) {
    next(error);
  }
});

api.post("/patterns/analyze", requireAuth, async (req, res, next) => {
  try {
    const report = await analyzePatterns(ownerId(req));
    res.status(201).json({ data: serializeDoc(report) });
  } catch (error) {
    next(error);
  }
});

api.get("/settings", requireAuth, async (req, res, next) => {
  try {
    res.json({ data: await getEffectiveSettings(ownerId(req)) });
  } catch (error) {
    next(error);
  }
});

api.patch("/settings", requireAuth, async (req, res, next) => {
  try {
    const settings = await upsertUserSettings(ownerId(req), settingsInputSchema.parse(req.body));
    res.json({ data: serializeDoc(settings) });
  } catch (error) {
    next(error);
  }
});

api.get("/admin/settings", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json({ data: await getEffectiveSettings() });
  } catch (error) {
    next(error);
  }
});

api.patch("/admin/settings", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const settings = await upsertAdminSettings(settingsInputSchema.parse(req.body));
    res.json({ data: serializeDoc(settings) });
  } catch (error) {
    next(error);
  }
});

api.get("/jobs", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).limit(100);
    res.json({ data: serializeMany(jobs) });
  } catch (error) {
    next(error);
  }
});
