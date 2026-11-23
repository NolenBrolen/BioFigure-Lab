import { join } from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrationsDir = join(import.meta.dirname, "drizzle");

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // The setup file applies these to the test database
        bindings: { TEST_MIGRATIONS: await readD1Migrations(migrationsDir) },
      },
    })),
  ],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
});
