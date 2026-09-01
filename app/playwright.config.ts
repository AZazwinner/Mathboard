import { defineConfig, devices } from "@playwright/test"

// Backend (FastAPI on :12001) is NOT started by this config - it has its
// own venv and isn't something Playwright's webServer can bootstrap
// portably. Run it separately (see src/main.py) before `npm run test:e2e`.
export default defineConfig({
    testDir: "./e2e",
    // Tests each sign up their own throwaway account (unique per run via a
    // timestamp), so they don't collide with each other's data - but they
    // do share the one dev backend process, so keep this off rather than
    // risk flakiness from true concurrent runs.
    fullyParallel: false,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: "http://localhost:12000",
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:12000",
        reuseExistingServer: true,
        timeout: 60_000,
    },
})
