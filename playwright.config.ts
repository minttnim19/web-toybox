import { defineConfig, devices } from '@playwright/test';

const PORT = 5299;

// End-to-end tests run against the *built* widget (dist/), served as a plain file.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run build && node e2e/server.mjs`,
    url: `http://localhost:${PORT}/plain.html`,
    env: { PORT: String(PORT) },
    // Always start fresh so tests never run against a stale build.
    reuseExistingServer: false,
    stdout: 'ignore',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
});
