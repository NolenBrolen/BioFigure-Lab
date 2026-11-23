import { configDefaults, defineConfig } from "vitest/config";

// Repo-wide tests only. Each workspace runs its own tests (npm test --workspaces).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
