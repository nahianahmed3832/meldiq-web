import { AccountApi } from "../auth/accountApi";
import type { Engine } from "./engine";
import { myProfile } from "./profile";

/** At most this many messages per conversation in one download (newest first), so a huge history can't stall the tab. */
const MESSAGES_PER_CONVERSATION = 20_000;

/**
 * Settings › My Account › Download your data (2026-10-28): one JSON file with the account, profile, communities,
 * conversations and the messages this browser holds. Messages are end-to-end encrypted, so the server can't export them:
 * the file is built here from what this browser decrypted, and never leaves the device except as the download. File
 * contents aren't included (each is kept encrypted until opened); their names and sizes are.
 */
export async function buildDataExport(engine: Engine, now: number = Date.now()): Promise<Blob> {
  const st = engine.state.get();
  const [account, profile] = await Promise.all([engine.device.account ? new AccountApi(engine.api).me().catch(() => null) : null, myProfile(engine).catch(() => null)]);
  const name = (userId: string) => (userId === st.me?.userId ? "you" : (st.users[userId]?.username ?? userId));
  const conversations = [];
  for (const c of Object.values(st.conversations)) {
    const messages = await engine.store.latestMessages(c.id, MESSAGES_PER_CONVERSATION);
    conversations.push({
      id: c.id,
      type: c.type,
      name: c.name ?? null,
      community: c.orgId ? (st.orgs.find((o) => o.id === c.orgId)?.name ?? c.orgId) : null,
      members: (c.members ?? []).map((m) => m.username),
      messages: messages
        .filter((m) => !m.deleted && m.kind !== "undecryptable")
        .sort((a, b) => a.sortTs - b.sortTs)
        .map((m) => ({
          at: new Date(m.sortTs).toISOString(),
          from: name(m.senderUserId),
          ...(m.kind === "call" ? { call: true } : { text: m.text }),
          ...(m.attachments.length ? { files: m.attachments.map((a) => ({ name: a.name, size: a.size, type: a.mime })) } : {}),
        })),
    });
  }
  const data = {
    exportedAt: new Date(now).toISOString(),
    about:
      "Your Meldiq data as this browser has it. Messages are end-to-end encrypted, so they come from this browser's own copy: messages from before this browser was set up, or never synced to it, aren't included.",
    account,
    profile,
    communities: st.orgs.map((o) => ({ id: o.id, name: o.name, role: o.myRole })),
    people: Object.values(st.users).map((u) => ({ id: u.id, username: u.username, displayName: u.displayName })),
    conversations,
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}
