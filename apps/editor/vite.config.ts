import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

/** The short commit on Cloudflare's build (Workers Builds sets WORKERS_CI_COMMIT_SHA), else "dev". Same rule as the site's statistics. */
const buildVersion = () => process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) || 'dev'

/** The editor's version and the build it came from (the same build version the live site's crash reports carry), sent along with bug reports. */
function appVersion() {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  return `${version}+${buildVersion()}`
}

// https://vite.dev/config/
export default defineConfig({
  // The editor lives at /app; the landing page (apps/site) owns /
  base: '/app/',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [react(), tailwindcss()],
  // While developing, /api goes to the Worker (`npm run dev -w apps/api`, port 8787; set API_PORT to use another).
  // Online the app and the API share one address, so the login cookie stays on one address here too.
  // 127.0.0.1, not localhost: Node may look up localhost as IPv6 (::1), and wrangler only listens on IPv4
  server: { proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? '8787'}` } },
})
