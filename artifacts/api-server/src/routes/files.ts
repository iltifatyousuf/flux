import { Router, type IRouter } from "express";
import { join } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { db, filesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  CreateFileBody,
  CreateFileResponse,
  GetFileParams,
  GetFileResponse,
  ListFilesResponse,
} from "@workspace/api-zod";

export type FileRecord = {
  id: string;
  name: string;
  kind: string;
  size: number;
  status: "ready" | "processing" | "error";
  createdAt: string;
  pages?: number | null;
};

const router: IRouter = Router();
const STORAGE_DIR = join(process.cwd(), "..", "..", ".data", "storage");

router.get("/files", async (req, res) => {
  const allFiles = await db.select().from(filesTable).orderBy(desc(filesTable.createdAt));
  
  const formattedFiles = allFiles.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.mimeType.split("/")[1]?.toUpperCase() || "FILE",
    size: f.size,
    status: "ready" as const,
    createdAt: new Date(f.createdAt).toLocaleString(),
  }));

  res.json(ListFilesResponse.parse(formattedFiles));
});

router.post("/files", async (req, res) => {
  const input = CreateFileBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Please provide a valid file name, type, and size." });
    return;
  }
  
  const fileId = `file-${Date.now()}`;
  const filePath = join(STORAGE_DIR, fileId);
  const buffer = Buffer.from(input.data.contentBase64 ?? "", "base64");
  
  await writeFile(filePath, buffer);
  
  const mime = input.data.mimeType || "application/octet-stream";
  
  await db.insert(filesTable).values({
    id: fileId,
    name: input.data.name,
    size: input.data.size,
    mimeType: mime,
    storagePath: filePath,
    createdAt: new Date(),
  });
  
  const file: FileRecord = {
    id: fileId,
    name: input.data.name,
    kind: mime.split("/")[1]?.toUpperCase() || "FILE",
    size: input.data.size,
    status: "ready",
    createdAt: new Date().toISOString(),
  };

  res.status(201).json(CreateFileResponse.parse(file));
});

router.get("/files/:id", async (req, res) => {
  const params = GetFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Invalid ID." });
    return;
  }
  
  const [f] = await db.select().from(filesTable).where(eq(filesTable.id, params.data.id));
  if (!f) {
    res.status(404).json({ error: "We couldn't find that file in your workspace." });
    return;
  }
  
  const file: FileRecord = {
    id: f.id,
    name: f.name,
    kind: f.mimeType.split("/")[1]?.toUpperCase() || "FILE",
    size: f.size,
    status: "ready",
    createdAt: new Date(f.createdAt).toLocaleString(),
  };
  
  res.json(GetFileResponse.parse(file));
  return;
});

export default router;