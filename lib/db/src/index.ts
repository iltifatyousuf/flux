import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema/index.js";
import { join } from "node:path";

const dbPath = process.env.DATABASE_URL || `file:${join(process.cwd(), "..", "..", ".data", "flux.db")}`;
export const sqlite = createClient({ url: dbPath });
export const db = drizzle(sqlite, { schema });

export * from "./schema/index.js";
