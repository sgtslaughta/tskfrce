import { defineConfig } from '@playwright/test'

const size = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
const projects = (['desktop', 'phone'] as const).flatMap((s) =>
  (['light', 'dark'] as const).map((colorScheme) => ({
    name: `${s}-${colorScheme}`,
    testMatch: 'screens.spec.ts',
    use: { viewport: size[s], colorScheme, isMobile: s === 'phone' },
  })),
)

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-artifacts/results',
  timeout: 90_000, // the dev server compiles each page on first visit
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://10.99.0.5:3000', trace: 'off' },
  // journeys change state, so they run once, after every screenshot of the seeded data
  projects: [
    ...projects,
    {
      name: 'journeys',
      testMatch: ['parent.spec.ts', 'chore-model.spec.ts', 'kid-app.spec.ts', 'devices-hours.spec.ts'],
      dependencies: projects.map((p) => p.name),
      use: { viewport: size.desktop, colorScheme: 'light' },
    },
  ],
})
