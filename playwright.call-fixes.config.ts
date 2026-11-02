import { defineConfig } from "@playwright/test";
import prepared from "./playwright.identity.config";
import raw from "./playwright.config";
const originals = Array.isArray(raw.webServer) ? raw.webServer : [];
const servers = Array.isArray(prepared.webServer) ? prepared.webServer : [];
const livekit = originals.find((s) => s.command.includes("livekit-dev.sh"));
export default defineConfig({ ...prepared, testMatch: "call-receipts-sidebar.spec.ts", webServer: [...servers, ...(livekit ? [livekit] : [])] });
