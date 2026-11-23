import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { appMeta } from "./db/schema";

// The API routes live under /api; the app files are served by the assets binding.
const api = new Hono<{ Bindings: Env }>().basePath("/api");

const HEALTH_KEY = "health/last-check.txt";
// The route is public, so write the R2 test file at most once a minute (caps R2 writes per month)
const MIN_WRITE_GAP_MS = 60_000;

// Checks that the database and the file storage both answer.
api.get("/health", async (c) => {
  let appMetaRows: number;
  try {
    const rows = await drizzle(c.env.DB).select({ n: count() }).from(appMeta);
    appMetaRows = rows[0]?.n ?? 0;
  } catch {
    return c.json({ ok: false, error: "D1 database failed" }, 500);
  }

  try {
    const existing = await c.env.FILES.head(HEALTH_KEY);
    const wroteNow = !existing || Date.now() - existing.uploaded.getTime() >= MIN_WRITE_GAP_MS;
    if (wroteNow) await c.env.FILES.put(HEALTH_KEY, new Date().toISOString());
    const readBack = await (await c.env.FILES.get(HEALTH_KEY))?.text();
    return c.json({
      ok: true,
      d1: { appMetaRows },
      r2: { key: HEALTH_KEY, wroteNow, readBack: readBack ?? null },
    });
  } catch {
    return c.json({ ok: false, error: "R2 storage failed" }, 500);
  }
});

const app = new Hono<{ Bindings: Env }>();

// A figure link, /app/fig/<id>, opens the editor: the address names the figure and the editor's
// page is served as it is. (Wrangler runs the Worker first for these addresses.)
app.get("/app/fig/*", (c) => c.env.ASSETS.fetch(new URL("/app/", c.req.url)));

app.route("/", api);
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
