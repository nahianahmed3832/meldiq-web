import base from "./playwright.config";
const servers = Array.isArray(base.webServer) ? base.webServer : [base.webServer!];
export default { ...base, webServer: servers.map((s) => s.command.includes("scripts/web-server.ts") ? { ...s, command: s.command.slice(s.command.indexOf("node scripts/web-server.ts")) } : s) };
