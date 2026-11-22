/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // itch.io serves the game from a sub-path, so every asset URL must be relative.
  base: './',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/game/**/*.ts'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
})
