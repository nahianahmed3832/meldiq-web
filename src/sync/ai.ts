import { z } from "zod";
import type { StoredMessage } from "../model/types";
import type { Engine } from "./engine";
import { type WfInput, zWfInput } from "./workflows";

/**
 * Workspace AI (server docs/AI.md, android round 7 slice C8): off until the server has a provider and the workspace's
 * admins turn it on. Every request that sends text carries `consent: true`, sent only when the person presses "Send to
 * <provider>" under a note naming the provider and what goes. The server keeps none of the text or the answer.
 */
const enc = encodeURIComponent;

export const WRITE_MODES = ["improve", "shorter", "friendlier", "formal", "fix_grammar"] as const;
export type WriteMode = (typeof WRITE_MODES)[number];
export const WRITE_LABEL: Record<WriteMode, string> = { improve: "Improve", shorter: "Shorter", friendlier: "Friendlier", formal: "More formal", fix_grammar: "Fix spelling" };

/** At most this many recent messages go into a catch-up, and at most this much text in all (android AiRules). */
export const CATCH_UP_MAX = 150;
export const CATCH_UP_CHARS = 30_000;
/** One very long message is cut, so it can't crowd out the rest. */
export const CATCH_UP_MESSAGE_CHARS = 2_000;
const AUTHOR_CHARS = 80;

export const REASON_TEXT: Record<string, string> = {
  not_configured: "This server has no AI provider set up yet.",
  workspace_off: "AI is turned off in this workspace.",
  guest: "Guests can't use AI in this workspace.",
};

const zProvider = z.object({ id: z.string(), name: z.string(), model: z.string().nullable() });
export type AiProvider = z.infer<typeof zProvider>;
const zStatus = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
  enabled: z.boolean(),
  canManage: z.boolean(),
  provider: zProvider.nullable(),
  providers: z.array(zProvider),
  chosenProvider: z.string().nullable(),
  monthly: z.object({ used: z.number(), limit: z.number().nullable() }),
  changedAt: z.number().nullable().optional(),
});
export type AiStatus = z.infer<typeof zStatus>;
const zAnswer = z.object({ text: z.string(), provider: zProvider });
export type AiAnswer = z.infer<typeof zAnswer>;
const zAsk = z.object({ text: z.string().nullable(), provider: zProvider.optional(), sources: z.array(z.object({ n: z.number(), id: z.string(), title: z.string() })), found: z.boolean() });
export type AiAsk = z.infer<typeof zAsk>;
const zDraft = z.object({ draft: zWfInput.nullable(), problems: z.array(z.string()), provider: zProvider });
export interface AiDraft {
  draft: WfInput | null;
  problems: string[];
  provider: AiProvider;
}
export interface CatchUpMessage {
  author: string;
  text: string;
  at: number;
}

export async function aiStatus(engine: Engine, orgId: string): Promise<AiStatus> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/ai`, z.object({ ai: zStatus }))).ai;
}
/** Admins with `workspace.edit`: the switch, and a configured provider or "default" for the server's. Audited. */
export async function setAiPolicy(engine: Engine, orgId: string, enabled: boolean, provider: string): Promise<AiStatus> {
  return (await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/ai`, z.object({ ai: zStatus }), { body: { enabled, provider } })).ai;
}
export async function aiWrite(engine: Engine, orgId: string, mode: WriteMode, text: string): Promise<AiAnswer> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/ai/write`, z.object({ result: zAnswer }), { body: { consent: true, mode, text } })).result;
}
/** [messages] were picked by [catchUpMessages] from what this browser decrypted; the server can't read them otherwise. */
export async function aiCatchUp(engine: Engine, orgId: string, channelId: string, messages: CatchUpMessage[]): Promise<AiAnswer> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/ai/catch-up`, z.object({ result: zAnswer }), { body: { consent: true, channelId, messages } })).result;
}
export async function aiDocumentSummary(engine: Engine, documentId: string): Promise<AiAnswer> {
  return (await engine.api.json("POST", `/v1/documents/${enc(documentId)}/ai/summary`, z.object({ result: zAnswer }), { body: { consent: true } })).result;
}
/** Only documents the person may read are searched; when none match, nothing goes to the provider. */
export async function aiAsk(engine: Engine, orgId: string, question: string): Promise<AiAsk> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/ai/ask`, z.object({ result: zAsk }), { body: { consent: true, question } })).result;
}
/** A draft validated like a saved workflow, switched off; never saved until the person saves it in the editor. */
export async function aiWorkflowDraft(engine: Engine, orgId: string, description: string, timeZone: string): Promise<AiDraft> {
  const r = (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/ai/workflow-draft`, z.object({ result: zDraft }), { body: { consent: true, description, timeZone } })).result;
  return { ...r, draft: r.draft ? { ...r.draft, enabled: false } : null };
}

/**
 * The newest readable messages, oldest first, within [CATCH_UP_MAX] and [CATCH_UP_CHARS] (android AiRules.catchUp).
 * Deleted, call and undecryptable messages are left out; [items] are oldest first, as the conversation keeps them.
 */
export function catchUpMessages(items: readonly StoredMessage[], nameOf: (userId: string) => string): CatchUpMessage[] {
  const picked: CatchUpMessage[] = [];
  let chars = 0;
  for (let i = items.length - 1; i >= 0 && picked.length < CATCH_UP_MAX; i--) {
    const m = items[i];
    const text = m.text.trim().slice(0, CATCH_UP_MESSAGE_CHARS);
    if (m.kind !== "text" || m.deleted || !text) continue;
    const author = nameOf(m.senderUserId).slice(0, AUTHOR_CHARS).trim() || "?";
    const cost = text.length + author.length + 2;
    if (chars + cost > CATCH_UP_CHARS) break;
    chars += cost;
    picked.push({ author, text, at: m.sortTs });
  }
  return picked.reverse();
}
