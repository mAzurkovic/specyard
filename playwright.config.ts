import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { headless: true },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
