import base from "./playwright.config";
const servers = Array.isArray(base.webServer) ? base.webServer : [base.webServer!];
export default {
  ...base,
  webServer: servers
    .filter((s) => !s.command.includes("livekit-dev"))
    .map((s) => (s.command.includes("scripts/web-server.ts") ? { ...s, command: `node scripts/web-server.ts dist ${process.env.ORBIT_E2E_WEB_PORT ?? 5181}` } : s)),
};
