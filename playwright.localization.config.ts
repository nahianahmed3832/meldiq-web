import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  testMatch: [
    "localization.spec.ts",
    "languages.spec.ts",
    "localization-call.spec.ts",
    "localization-public.spec.ts",
    "smooth-auth-upload.spec.ts",
    "media-sharing.spec.ts",
    "paypal-existing-regression.spec.ts",
  ],
  projects: config.projects?.filter((project) => ["chromium", "phone-width"].includes(project.name ?? "")),
});
