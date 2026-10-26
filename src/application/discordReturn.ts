/**
 * Coming back from Discord after adding Meldiq's bot (meldiq docs/DISCORD_IMPORT.md): Discord opens
 * /discord/callback?code&state&guild_id (or ?error=access_denied when the person cancels). At start the page keeps that
 * for this tab and moves the address to Home, so the code never stays in the address bar or history; the shell then
 * reopens the import, which hands the code to the server once.
 */
const KEY = "meldiq.discordReturn";
const CODE = /^[A-Za-z0-9._~-]{1,200}$/;
const SNOWFLAKE = /^\d{5,25}$/;

export type DiscordReturn = { kind: "connected"; code: string; state: string; guildId: string | null } | { kind: "cancelled" };

export function discordReturnFrom(pathname: string, search: string): DiscordReturn | null {
  if (!/^\/discord\/callback\/?$/.test(pathname)) return null;
  const q = new URLSearchParams(search);
  const code = q.get("code");
  const state = q.get("state");
  if (code && state && CODE.test(code) && CODE.test(state)) {
    const guild = q.get("guild_id");
    return { kind: "connected", code, state, guildId: guild && SNOWFLAKE.test(guild) ? guild : null };
  }
  return { kind: "cancelled" };
}

let pending: DiscordReturn | null = null;

export function captureDiscordReturn(): void {
  const ret = discordReturnFrom(location.pathname, location.search);
  if (!ret) return;
  pending = ret;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ret));
  } catch {
    /* kept in memory for this page */
  }
  history.replaceState(history.state, "", "/home");
}

/** The kept return from Discord, once (null if none). */
export function takeDiscordReturn(): DiscordReturn | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* in memory only */
  }
  const ret = pending ?? (raw ? parse(raw) : null);
  pending = null;
  return ret;
}

function parse(raw: string): DiscordReturn | null {
  try {
    const v = JSON.parse(raw) as Partial<{ kind: string; code: string; state: string; guildId: string | null }>;
    if (v.kind === "cancelled") return { kind: "cancelled" };
    if (v.kind === "connected" && typeof v.code === "string" && typeof v.state === "string" && CODE.test(v.code) && CODE.test(v.state)) {
      return { kind: "connected", code: v.code, state: v.state, guildId: typeof v.guildId === "string" && SNOWFLAKE.test(v.guildId) ? v.guildId : null };
    }
  } catch {
    /* ignored */
  }
  return null;
}
