import { drizzle } from "drizzle-orm/d1";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { appMeta } from "../src/db/schema";

const get = (path: string) => exports.default.fetch(`http://example.com${path}`);

describe("GET /api/health", () => {
  it("reports ok with the database row count", async () => {
    await drizzle(env.DB).insert(appMeta).values({ key: "k", value: "v" }).onConflictDoNothing();
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; d1: { appMetaRows: number } }>();
    expect(body.ok).toBe(true);
    expect(body.d1.appMetaRows).toBeGreaterThanOrEqual(1);
  });

  it("writes the time to R2 on the first call", async () => {
    // An earlier test may have written it already
    await env.FILES.delete("health/last-check.txt");
    const res = await get("/api/health");
    const body = await res.json<{ r2: { key: string; wroteNow: boolean; readBack: string } }>();
    expect(body.r2.wroteNow).toBe(true);
    const stored = await env.FILES.get(body.r2.key);
    expect(await stored?.text()).toBe(body.r2.readBack);
  });

  it("does not write again within a minute", async () => {
    type R2Body = { r2: { wroteNow: boolean; readBack: string } };
    const first = await (await get("/api/health")).json<R2Body>();
    const second = await (await get("/api/health")).json<R2Body>();
    expect(second.r2.wroteNow).toBe(false);
    expect(second.r2.readBack).toBe(first.r2.readBack);
  });

  it("answers 500 with the failing part when D1 breaks", async () => {
    const real = env.DB.prepare.bind(env.DB);
    env.DB.prepare = () => {
      throw new Error("boom");
    };
    try {
      const res = await get("/api/health");
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, error: "D1 database failed" });
    } finally {
      env.DB.prepare = real;
    }
  });
});

describe("unknown routes", () => {
  it("answers 404 JSON under /api", async () => {
    const res = await get("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});

describe("figure links", () => {
  it("serves the editor's page for /app/fig/<id>", async () => {
    const asked: string[] = [];
    const real = env.ASSETS.fetch.bind(env.ASSETS);
    env.ASSETS.fetch = (input) => {
      asked.push(new Request(input).url);
      return Promise.resolve(new Response("editor page"));
    };
    try {
      const res = await get("/app/fig/abc123");
      expect(await res.text()).toBe("editor page");
      expect(asked).toEqual(["http://example.com/app/"]);
    } finally {
      env.ASSETS.fetch = real;
    }
  });
});

describe("database", () => {
  it("reads app_meta through Drizzle after the migrations", async () => {
    const db = drizzle(env.DB);
    await db.insert(appMeta).values({ key: "schema", value: "1" }).onConflictDoNothing();
    const rows = await db.select().from(appMeta);
    expect(rows).toContainEqual({ key: "schema", value: "1" });
  });
});
