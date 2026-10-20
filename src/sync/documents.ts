import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Workspace documents (server docs/DOCUMENTS.md, android round 7 slice C4): pages a workspace writes together. By the
 * owner's decision they're readable by the server (so they can be searched) and **not end-to-end encrypted**, which the
 * interface says wherever they're shown. The server checks every access; without a role a document is a 404.
 */
export const DOC_ROLES = ["view", "comment", "edit", "admin"] as const;
export type DocRole = (typeof DOC_ROLES)[number];
export const ACCESS = ["workspace", "channel", "restricted"] as const;
export type DocAccess = (typeof ACCESS)[number];
export const DEFAULT_ROLES = ["view", "comment", "edit"] as const;
export const MAX_TITLE = 120;
export const MAX_CONTENT = 200_000;

const RANK: Record<string, number> = { view: 0, comment: 1, edit: 2, admin: 3 };
/** Whether [role] is at least [needed] (android DocRules.atLeast). */
export const atLeast = (role: string | null | undefined, needed: DocRole): boolean => (RANK[role ?? ""] ?? -1) >= RANK[needed];

export const ACCESS_LABEL: Record<DocAccess, string> = { workspace: "Everyone in the workspace", channel: "Members of a channel", restricted: "Only people added" };
export const ROLE_LABEL: Record<DocRole, string> = { view: "Can view", comment: "Can comment", edit: "Can edit", admin: "Admin" };

const zPerson = z.object({ id: z.string(), name: z.string().nullable() });
const zSummary = z.object({
  id: z.string(),
  orgId: z.string(),
  title: z.string(),
  access: z.enum(ACCESS),
  defaultRole: z.string(),
  channel: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  role: z.enum(DOC_ROLES),
  rev: z.number(),
  archived: z.boolean(),
  createdBy: zPerson,
  updatedBy: zPerson,
  createdAt: z.number(),
  updatedAt: z.number(),
  encryption: z.string(),
});
export type DocSummary = z.infer<typeof zSummary>;
const zDoc = zSummary.extend({
  content: z.string(),
  /** Admins only: people added and their roles (absent for everyone else). */
  members: z
    .array(z.object({ userId: z.string(), role: z.enum(DOC_ROLES), name: z.string().nullable(), username: z.string() }))
    .optional()
    .transform((v) => v ?? []),
});
export type Doc = z.infer<typeof zDoc>;
const zVersion = z.object({ rev: z.number(), title: z.string(), author: zPerson, createdAt: z.number() });
export type DocVersion = z.infer<typeof zVersion>;
const zComment = z.object({ id: z.string(), author: zPerson, body: z.string(), quote: z.string().nullable(), resolved: z.boolean(), createdAt: z.number(), canDelete: z.boolean() });
export type DocComment = z.infer<typeof zComment>;
const zTemplate = z.object({ id: z.string(), title: z.string(), content: z.string() });
export type DocTemplate = z.infer<typeof zTemplate>;

export interface Sharing {
  access: DocAccess;
  defaultRole: (typeof DEFAULT_ROLES)[number];
  channelId: string | null;
  members: { userId: string; role: DocRole }[];
}

const enc = encodeURIComponent;
const doc = z.object({ document: zDoc });

export async function docTemplates(engine: Engine): Promise<DocTemplate[]> {
  return (await engine.api.json("GET", "/v1/documents/templates", z.object({ templates: z.array(zTemplate) }))).templates;
}
export async function listDocuments(engine: Engine, orgId: string, archived = false): Promise<DocSummary[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/documents${archived ? "?archived=true" : ""}`, z.object({ documents: z.array(zSummary) }))).documents;
}
export async function createDocument(engine: Engine, orgId: string, input: Sharing & { title: string; content: string }): Promise<Doc> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/documents`, doc, { body: input })).document;
}
export async function getDocument(engine: Engine, id: string): Promise<Doc> {
  return (await engine.api.json("GET", `/v1/documents/${enc(id)}`, doc)).document;
}
/** Saving names the revision it started from; if someone saved meanwhile the server answers 409 `stale_revision`. */
export async function saveDocument(engine: Engine, id: string, rev: number, title: string, content: string): Promise<Doc> {
  return (await engine.api.json("PUT", `/v1/documents/${enc(id)}`, doc, { body: { rev, title, content } })).document;
}
export async function shareDocument(engine: Engine, id: string, sharing: Sharing): Promise<Doc> {
  return (await engine.api.json("PUT", `/v1/documents/${enc(id)}/sharing`, doc, { body: sharing })).document;
}
export async function setDocumentArchived(engine: Engine, id: string, archived: boolean): Promise<Doc> {
  return (await engine.api.json("POST", `/v1/documents/${enc(id)}/${archived ? "archive" : "restore"}`, doc, { body: {} })).document;
}
export async function deleteDocument(engine: Engine, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/documents/${enc(id)}`);
}
export async function documentVersions(engine: Engine, id: string): Promise<DocVersion[]> {
  return (await engine.api.json("GET", `/v1/documents/${enc(id)}/versions`, z.object({ versions: z.array(zVersion) }))).versions;
}
export async function documentVersion(engine: Engine, id: string, rev: number): Promise<DocVersion & { content: string }> {
  return (await engine.api.json("GET", `/v1/documents/${enc(id)}/versions/${rev}`, z.object({ version: zVersion.extend({ content: z.string() }) }))).version;
}
/** Brings an earlier version back as a new revision; nothing is lost. */
export async function restoreVersion(engine: Engine, id: string, rev: number): Promise<Doc> {
  return (await engine.api.json("POST", `/v1/documents/${enc(id)}/versions/${rev}/restore`, doc, { body: {} })).document;
}
export async function documentComments(engine: Engine, id: string): Promise<DocComment[]> {
  return (await engine.api.json("GET", `/v1/documents/${enc(id)}/comments`, z.object({ comments: z.array(zComment) }))).comments;
}
export async function addComment(engine: Engine, id: string, body: string, quote: string | null): Promise<DocComment> {
  return (await engine.api.json("POST", `/v1/documents/${enc(id)}/comments`, z.object({ comment: zComment }), { body: { body, quote } })).comment;
}
export async function resolveComment(engine: Engine, commentId: string, resolved: boolean): Promise<void> {
  await engine.api.call("POST", `/v1/document-comments/${enc(commentId)}/resolve`, { body: { resolved } });
}
export async function deleteComment(engine: Engine, commentId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/document-comments/${enc(commentId)}`);
}

/** The document as Markdown, the way the server exports it (`# title` then the text). */
export const exportMarkdown = (d: Pick<Doc, "title" | "content">): string => `# ${d.title}\n\n${d.content}`;

// ───── the small Markdown subset documents are shown with (android DocRules.parse / inline); never HTML ─────

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "bullet"; text: string; checked: boolean | null }
  | { kind: "numbered"; number: string; text: string }
  | { kind: "quote"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "gap" };

const HEADING = /^(#{1,3})\s+(.*)$/;
const CHECK = /^[-*]\s+\[( |x|X)]\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^(\d{1,3})[.)]\s+(.*)$/;

/** Line-based: each line is one block; consecutive blank lines collapse into one gap. */
export function parseMarkdown(markdown: string): Block[] {
  const out: Block[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    let b: Block;
    let m: RegExpExecArray | null;
    if (!line.trim()) b = { kind: "gap" };
    else if ((m = HEADING.exec(line))) b = { kind: "heading", level: m[1].length, text: m[2] };
    else if ((m = CHECK.exec(line))) b = { kind: "bullet", text: m[2], checked: m[1].trim() !== "" };
    else if ((m = BULLET.exec(line))) b = { kind: "bullet", text: m[1], checked: null };
    else if ((m = NUMBERED.exec(line))) b = { kind: "numbered", number: m[1], text: m[2] };
    else if (line.startsWith(">")) b = { kind: "quote", text: line.slice(1).trim() };
    else b = { kind: "paragraph", text: line };
    if (b.kind === "gap" && (out.length === 0 || out[out.length - 1].kind === "gap")) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].kind === "gap") out.pop();
  return out;
}

/** Inline spans: `**bold**` and `` `code` ``; anything else is plain text. */
export function inlineSpans(text: string): { text: string; bold: boolean; code: boolean }[] {
  const out: { text: string; bold: boolean; code: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/\*\*(.+?)\*\*|`([^`]+)`/g)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: text.slice(at, i), bold: false, code: false });
    if (m[1]) out.push({ text: m[1], bold: true, code: false });
    else out.push({ text: m[2], bold: false, code: true });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), bold: false, code: false });
  return out;
}
