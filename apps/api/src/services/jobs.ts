import { nanoid } from "nanoid";
import type { JobType } from "@memora/shared";
import { Decision, Job, KnowledgeObject } from "../models";
import { harvestKnowledge, generateDecisionReview } from "./ai";
import { embedKnowledgeObject } from "./embedding";
import { detectRelationships } from "./relationships";
import { analyzePatterns, generateWeeklyReport } from "./reports";

export async function enqueueJob(ownerId: string, type: JobType, payload: Record<string, unknown>, scheduledFor = new Date()) {
  return Job.create({ ownerId, type, payload, scheduledFor });
}

export async function processNextJob(workerId = nanoid()) {
  const job = await Job.findOneAndUpdate(
    { status: "queued", scheduledFor: { $lte: new Date() } },
    { $set: { status: "running", lockOwner: workerId, lockedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { scheduledFor: 1, createdAt: 1 }, new: true }
  );

  if (!job) return null;

  try {
    await runJob(job);
    job.status = "succeeded";
    job.result = { completedAt: new Date().toISOString() };
    job.error = undefined;
  } catch (error) {
    job.error = error instanceof Error ? error.message : "Unknown job error";
    job.status = job.attempts >= job.maxAttempts ? "failed" : "queued";
  } finally {
    job.lockOwner = undefined;
    job.lockedAt = undefined;
    await job.save();
  }

  return job;
}

async function runJob(job: any) {
  const ownerId = job.ownerId.toString();
  if (job.type === "harvest") {
    const knowledgeObjectId = String(job.payload.knowledgeObjectId);
    const object = await KnowledgeObject.findOne({ _id: knowledgeObjectId, ownerId });
    if (!object) return;
    object.status = "processing";
    await object.save();
    const result = await harvestKnowledge(ownerId, object.rawContent, object.title);
    Object.assign(object, {
      title: result.title,
      structuredSummary: result.structuredSummary,
      keyInsights: result.keyInsights,
      principles: result.principles,
      decisions: result.decisions,
      lessons: result.lessons,
      frameworks: result.frameworks,
      opportunities: result.opportunities,
      risks: result.risks,
      questions: result.questions,
      tags: result.tags,
      categories: result.categories,
      confidenceScore: result.confidenceScore,
      status: "ready",
      processingError: undefined
    });
    await object.save();
    await enqueueJob(ownerId, "embedding", { knowledgeObjectId });
    await enqueueJob(ownerId, "relationship_detection", { knowledgeObjectId });
    return;
  }

  if (job.type === "embedding") {
    await embedKnowledgeObject(ownerId, String(job.payload.knowledgeObjectId));
    return;
  }

  if (job.type === "relationship_detection") {
    await detectRelationships(ownerId, String(job.payload.knowledgeObjectId));
    return;
  }

  if (job.type === "weekly_report") {
    await generateWeeklyReport(ownerId);
    return;
  }

  if (job.type === "pattern_analysis") {
    await analyzePatterns(ownerId);
    return;
  }

  if (job.type === "decision_review") {
    const decision = await Decision.findOne({ _id: job.payload.decisionId, ownerId });
    if (!decision || !decision.actualOutcome) return;
    decision.learningReport = await generateDecisionReview(ownerId, {
      title: decision.title,
      context: decision.context,
      reasoning: decision.reasoning,
      expectedOutcome: decision.expectedOutcome,
      actualOutcome: decision.actualOutcome
    });
    await decision.save();
  }
}
