import { defineConfig } from "@playwright/test";
import base from "./playwright.identity.config";
export default defineConfig({ ...base, testMatch: "poll-media.spec.ts" });
