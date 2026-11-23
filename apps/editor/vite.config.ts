import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // The editor lives at /app; the landing page (apps/site) owns /
  base: '/app/',
  plugins: [react(), tailwindcss()],
})
