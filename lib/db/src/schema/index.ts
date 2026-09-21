import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  whopToken: text("whop_token"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const filesTable = sqliteTable("files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const jobsTable = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull(),
  operation: text("operation").notNull(),
  status: text("status").notNull(), // queued, processing, completed, error
  progress: integer("progress").notNull(),
  message: text("message"),
  resultFileId: text("result_file_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export type User = typeof usersTable.$inferSelect;

export const insertFileSchema = createInsertSchema(filesTable);
export type FileRecord = typeof filesTable.$inferSelect;

export const insertJobSchema = createInsertSchema(jobsTable);
export type Job = typeof jobsTable.$inferSelect;