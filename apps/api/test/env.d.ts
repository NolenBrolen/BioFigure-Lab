import type { D1Migration } from "cloudflare:test";

// The test config adds the migrations as a binding; the real Worker has no such binding.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
