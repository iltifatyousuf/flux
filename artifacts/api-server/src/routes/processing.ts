import { Router, type IRouter } from "express";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { db, jobsTable, filesTable, usersTable, type Job } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateProcessingJobBody,
  CreateProcessingJobResponse,
  GetProcessingJobParams,
  GetProcessingJobResponse,
} from "@workspace/api-zod";
import { processFile } from "../lib/processor";

const router: IRouter = Router();
const STORAGE_DIR = join(process.cwd(), "..", "..", ".data", "storage");

router.post("/processing/jobs", async (req, res) => {
  const input = CreateProcessingJobBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  
  const [f] = await db.select().from(filesTable).where(eq(filesTable.id, input.data.fileId));
  if (!f) {
    res.status(400).json({ error: "Choose a valid file before starting this operation." });
    return;
  }

  // Whop Paywall Check
  const proOperations = new Set([
    'summarize-document', 'ask-questions-about-pdf', 'rewrite-document',
    'translate-document', 'generate-flashcards', 'generate-mcqs', 'resume-analyzer',
    'gpa-calculator', 'percentage-calculator', 'cgpa-calculator', 'attendance-calculator',
    'assignment-formatter', 'citation-generator', 'question-paper-generator'
  ]);

  if (proOperations.has(input.data.operation)) {
    const productId = process.env.WHOP_PRODUCT_ID;
    let userToken = req.header("x-whop-user-token"); // Fallback to header
    
    // Check DB if session exists
    if (!userToken && req.cookies?.flux_session) {
      try {
        const jwt = await import("jsonwebtoken");
        const decoded = jwt.verify(req.cookies.flux_session, process.env.JWT_SECRET || "flux-super-secret-key-123") as any;
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));
        if (user && user.whopToken) {
          userToken = user.whopToken;
        }
      } catch (err) {
        // ignore jwt errors
      }
    }
    
    let hasAccess = false;

    if (productId && userToken) {
      try {
        const { getWhopClient } = await import("../lib/whopClient");
        const { WhopClient } = await import("@whop/sdk");
        const accountClient = await getWhopClient();
        const userClient = new WhopClient({ token: userToken });
        const user = await userClient.users.retrieve({ id: "me" });
        const access = await accountClient.users.checkAccess({
          id: user.id,
          resource_id: productId,
        });
        hasAccess = Boolean(access.has_access);
      } catch (error) {
        req.log?.warn({ err: error }, "Whop access verification failed during job creation");
      }
    }

    if (!hasAccess) {
      res.status(403).json({ error: "This operation requires an active FLUX Pro membership." });
      return;
    }
  }

  const jobId = `job-${Date.now()}`;
  
  await db.insert(jobsTable).values({
    id: jobId,
    fileId: input.data.fileId,
    operation: input.data.operation,
    status: "queued",
    progress: 0,
    message: "Queued for processing.",
    createdAt: new Date(),
  });
  
  const jobPayload = {
    id: jobId,
    ...input.data,
    status: "queued" as const,
    progress: 0,
    message: "Queued for processing.",
  };

  res.status(201).json(CreateProcessingJobResponse.parse(jobPayload));
  
  // Background processing kick-off (acts as our lightweight worker)
  void executeJob(jobId, input.data.question);
});

async function executeJob(jobId: string, question?: string) {
  try {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
    if (!job) return;
    
    const [file] = await db.select().from(filesTable).where(eq(filesTable.id, job.fileId));
    if (!file) throw new Error("Source file missing.");
    
    await db.update(jobsTable).set({ status: "processing", progress: 15, message: "Reading your file." }).where(eq(jobsTable.id, jobId));
    
    const bytes = await readFile(file.storagePath);
    
    const result = await processFile({
      bytes,
      name: file.name,
      operation: job.operation,
      question,
    });
    
    const resultFileId = `res-${Date.now()}`;
    const resultPath = join(STORAGE_DIR, resultFileId);
    await writeFile(resultPath, result.bytes);
    
    // Store result metadata
    await db.insert(filesTable).values({
      id: resultFileId,
      name: result.name,
      size: result.bytes.length,
      mimeType: result.contentType,
      storagePath: resultPath,
      createdAt: new Date(),
    });
    
    await db.update(jobsTable).set({
      status: "completed",
      progress: 100,
      message: "Your file is ready to download.",
      resultFileId,
    }).where(eq(jobsTable.id, jobId));
    
  } catch (error) {
    await db.update(jobsTable).set({
      status: "error", // Using 'error' status per schema
      progress: 100,
      message: error instanceof Error ? error.message : "Processing failed.",
    }).where(eq(jobsTable.id, jobId));
  }
}

router.get("/processing/jobs/:id", async (req, res) => {
  const params = GetProcessingJobParams.safeParse(req.params);
  if (!params.success) return res.status(404).json({ error: "Invalid ID." });
  
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "That processing job is no longer available." });
    return;
  }
  
  const responseJob = {
    id: job.id,
    fileId: job.fileId,
    operation: job.operation,
    status: job.status as "queued" | "processing" | "completed" | "failed", // Cast to match API schema (failed vs error)
    progress: job.progress,
    message: job.message || undefined,
    resultUrl: job.resultFileId ? `/api/processing/jobs/${job.id}/result` : undefined,
  };
  
  if (responseJob.status === "error" as any) responseJob.status = "failed"; // Normalizing schema 'error' to api 'failed'
  
  res.json(GetProcessingJobResponse.parse(responseJob));
});

router.get("/processing/jobs/:id/result", async (req, res) => {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, req.params.id));
  if (!job || !job.resultFileId) {
    res.status(404).json({ error: "That result is not ready yet." });
    return;
  }
  
  const [resFile] = await db.select().from(filesTable).where(eq(filesTable.id, job.resultFileId));
  if (!resFile) {
    res.status(404).json({ error: "Result file missing." });
    return;
  }
  
  const bytes = await readFile(resFile.storagePath);
  res.setHeader("Content-Type", resFile.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${resFile.name.replace(/"/g, "")}"`);
  res.send(bytes);
  return;
});

export default router;