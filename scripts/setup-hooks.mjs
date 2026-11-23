// Runs after `npm install`: turns on the checks in .githooks/ before each commit.
// A copy without git (e.g. a downloaded source zip) has nothing to set up, so it skips quietly.
import { execFileSync } from 'node:child_process'

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
} catch {
  // Not a git checkout.
}
