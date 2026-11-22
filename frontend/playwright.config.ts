import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
// itch.io serves HTML games from a sub-path like this one.
export const GAME_PATH = '/html/12345/';
export const GAME_URL = `http://127.0.0.1:${port}${GAME_PATH}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort --base ${GAME_PATH}`,
    url: GAME_URL,
    reuseExistingServer: !process.env.CI,
  },
});
