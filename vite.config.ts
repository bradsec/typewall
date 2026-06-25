import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',                 // relative paths so it works on GitHub Pages subpaths
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
})
