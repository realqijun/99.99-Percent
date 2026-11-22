/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// The balance simulation is slow, so `npm test` leaves it out and `npm run balance` runs only it.
const BALANCE_TEST = 'src/engine/__tests__/balance.test.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // itch.io serves the game from a sub-path, so every asset URL must be relative.
  base: './',
  test:
    mode === 'balance'
      ? { environment: 'node', include: [BALANCE_TEST], testTimeout: 300_000 }
      : {
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, BALANCE_TEST],
          coverage: {
            provider: 'v8',
            include: ['src/engine/**/*.ts', 'src/game/**/*.ts'],
            reporter: ['text', 'html', 'json-summary'],
          },
        },
}))
