import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { db, filesTable, jobsTable } from "@workspace/db";
import { desc, count, sum } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const [{ count: filesCount }] = await db.select({ count: count() }).from(filesTable);
  const [{ totalSize }] = await db.select({ totalSize: sum(filesTable.size) }).from(filesTable);
  const recentFiles = await db.select().from(filesTable).orderBy(desc(filesTable.createdAt)).limit(3);

  const storageUsedStr = totalSize ? `${Math.round(Number(totalSize) / 1000000)} MB` : "0 MB";

  const recentActivity = recentFiles.map((f, i) => ({
    id: `activity-${i}`,
    label: "File uploaded",
    detail: f.name,
    time: new Date(f.createdAt).toLocaleString(),
  }));

  res.json(
    GetDashboardSummaryResponse.parse({
      filesProcessed: filesCount,
      storageUsed: storageUsedStr,
      aiRequests: 0,
      plan: "Free",
      usagePercent: 62,
      recentActivity: recentActivity.length ? recentActivity : [
        { id: "activity-empty", label: "No activity yet", detail: "Upload your first file to get started.", time: "Just now" }
      ],
    }),
  );
});

export default router;