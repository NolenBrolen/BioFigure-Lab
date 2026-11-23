import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Runs before the tests: builds the tables in the test database
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
