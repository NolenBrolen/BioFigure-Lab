import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Storybook reads this file too, so React and Tailwind work in stories.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
