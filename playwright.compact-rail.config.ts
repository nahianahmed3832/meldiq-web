import { defineConfig } from "@playwright/test";
import base from "./playwright.rules.config";
export default defineConfig({
  ...base,
  testMatch: "compact-rail.spec.ts",
  projects: [
    { name: "chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { browserName: "webkit", viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { browserName: "firefox", viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { browserName: "chromium", viewport: { width: 393, height: 852 }, isMobile: true } },
  ],
  expect: { timeout: 20_000 },
});
