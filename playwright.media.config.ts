import { defineConfig } from "@playwright/test";
import base from "./playwright.identity.config";
import browsers from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "media-sharing.spec.ts",
  projects: browsers.projects?.filter((project) => ["chromium", "webkit", "phone-width", "iphone-width"].includes(project.name ?? "")),
});
