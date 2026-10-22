import { z } from "zod";
import {
  type Ban,
  type Category,
  type CommunityPreview,
  type CommunityTemplate,
  type Discovered,
  type JoinApplication,
  type Overwrites,
  type SecurityState,
  zApplicationOut,
  zApplications,
  zBans,
  zCategories,
  zCategory,
  zChannelList,
  zDiscoverPage,
  zJoined,
  zLayoutResult,
  zOverwrites,
  zPreview,
  zSecurity,
  zTemplates,
} from "../api/communitySchemas";
import { type Conversation, type Org, zConversation, zOrg } from "../api/schemas";
import { zChannelOut } from "../api/workspaceSchemas";
import type { LayoutChannel } from "./communityRules";
import type { Engine } from "./engine";

/**
 * Community structure, discovery and moderation from the browser (server/src/routes/community.ts, orgs.ts,
 * conversations.ts, applications.ts). The same endpoints Meldiq Android calls; every change is checked by the server,
 * which also tells every member's devices (`org.updated`, `conv.updated`).
 */

const enc = encodeURIComponent;

export interface CommunityData {
  categories: Category[];
  /** Every channel this person may see, joined or not (GET /v1/orgs/:id/channels). */
  channels: Conversation[];
  loadedAt: number;
}

/** Keeps each opened community's categories and channel list, reloaded when the server says the community changed. */
export class CommunitySync {
  private loading = new Map<string, Promise<void>>();

  constructor(
    private readonly host: {
      json: Engine["api"]["json"];
      features: () => string[];
      publish: (orgId: string, data: CommunityData | null) => void;
      loaded: (orgId: string) => boolean;
    },
  ) {}

  /** Whether the server has communities with categories (API 0.12+). */
  get available(): boolean {
    return this.host.features().includes("community-channels");
  }

  refresh(orgId: string): Promise<void> {
    if (!this.available) return Promise.resolve();
    let p = this.loading.get(orgId);
    if (!p) {
      p = (async () => {
        try {
          const [cats, chans] = await Promise.all([this.host.json("GET", `/v1/orgs/${enc(orgId)}/categories`, zCategories), this.host.json("GET", `/v1/orgs/${enc(orgId)}/channels`, zChannelList)]);
          this.host.publish(orgId, { categories: cats.categories, channels: chans.channels, loadedAt: Date.now() });
        } catch {
          /* offline, or no longer a member: keep what's shown; the org list update removes a community you left */
        }
      })().finally(() => this.loading.delete(orgId));
      this.loading.set(orgId, p);
    }
    return p;
  }

  /** After `org.updated`: the communities already shown load again. */
  refreshLoaded(orgIds: readonly string[]): void {
    for (const id of orgIds) if (this.host.loaded(id)) void this.refresh(id);
  }

  forget(orgId: string): void {
    this.host.publish(orgId, null);
  }
}

// ───────────── categories and layout ─────────────

export async function createCategory(engine: Engine, orgId: string, name: string): Promise<Category> {
  const { category } = await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/categories`, z.object({ category: zCategory }), { body: { name: name.trim() } });
  await engine.community.refresh(orgId);
  return category;
}

export async function renameCategory(engine: Engine, orgId: string, categoryId: string, name: string): Promise<void> {
  await engine.api.call("PATCH", `/v1/categories/${enc(categoryId)}`, { body: { name: name.trim() } });
  await engine.community.refresh(orgId);
}

/** Its channels stay, without a category. Refused (409 category_has_permissions) while its rules decide who sees them. */
export async function deleteCategory(engine: Engine, orgId: string, categoryId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/categories/${enc(categoryId)}`);
  await engine.community.refresh(orgId);
  await engine.refreshAll();
}

/** One atomic write: category order (listed first), and each listed channel's category and position. */
export async function saveLayout(engine: Engine, orgId: string, layout: { categories?: string[]; channels?: LayoutChannel[] }): Promise<{ removed: number }> {
  const r = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/layout`, zLayoutResult, { body: { categories: layout.categories ?? [], channels: layout.channels ?? [] } });
  await engine.community.refresh(orgId);
  await engine.refreshAll();
  return { removed: r.removed };
}

// ───────────── channels ─────────────

export interface NewChannel {
  name: string;
  topic: string | null;
  kind: "PUBLIC" | "PRIVATE" | "ANNOUNCEMENT";
  voice: boolean;
  format: "text" | "forum";
  categoryId: string | null;
}

export async function createCommunityChannel(engine: Engine, orgId: string, c: NewChannel): Promise<Conversation> {
  const { channel } = await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/channels`, zChannelOut, {
    body: {
      name: c.name.trim(),
      topic: c.topic?.trim() || null,
      scope: "ORG",
      kind: c.kind,
      voice: c.voice,
      format: c.format,
      categoryId: c.categoryId,
      ...(c.kind === "PUBLIC" ? { autoJoin: true } : {}),
    },
  });
  await engine.community.refresh(orgId);
  await engine.refreshAll();
  return channel;
}

export interface ChannelChange {
  name?: string;
  topic?: string | null;
  archived?: boolean;
  kind?: "PUBLIC" | "PRIVATE" | "ANNOUNCEMENT";
  format?: "text" | "forum";
  forumTags?: { id?: string; name: string }[];
  guidelines?: string | null;
  slowmodeSec?: number;
}

export async function updateChannel(engine: Engine, id: string, change: ChannelChange): Promise<Conversation> {
  const { conversation } = await engine.api.json("PATCH", `/v1/conversations/${enc(id)}`, z.object({ conversation: zConversation }), { body: change });
  if (conversation.orgId) await engine.community.refresh(conversation.orgId);
  await engine.refreshAll();
  return conversation;
}

/** Deletes a channel for everyone, with its messages' server copies and files; the exact name must be typed. */
export async function deleteChannel(engine: Engine, orgId: string, id: string, confirmName: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/conversations/${enc(id)}`, { body: { confirmName } });
  await engine.community.refresh(orgId);
  await engine.refreshAll();
}

/** Opens a channel you may see but haven't joined (public channels join on open, as on the phone). */
export async function joinCommunityChannel(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("POST", `/v1/conversations/${enc(id)}/join`);
  await engine.ensureConversation(id);
  await engine.refreshAll();
  await engine.community.refresh(orgId);
}

// ───────────── permission overwrites ─────────────

export type OverwriteTarget = { type: "category"; id: string } | { type: "channel"; id: string };

const overwritePath = (t: OverwriteTarget) => (t.type === "category" ? `/v1/categories/${enc(t.id)}/overwrites` : `/v1/conversations/${enc(t.id)}/overwrites`);

export function overwrites(engine: Engine, t: OverwriteTarget): Promise<Overwrites> {
  return engine.api.json("GET", overwritePath(t), zOverwrites);
}

/** Sets one subject's allow and deny (both empty removes the rule). The server re-checks everyone's access afterwards. */
export async function setOverwrite(engine: Engine, orgId: string, t: OverwriteTarget, subject: string, allow: string[], deny: string[]): Promise<Overwrites> {
  const r = await engine.api.json("PUT", overwritePath(t), zOverwrites, { body: { subject, allow, deny } });
  await engine.community.refresh(orgId);
  return r;
}

// ───────────── creating, discovering and joining ─────────────

export async function communityTemplates(engine: Engine): Promise<CommunityTemplate[]> {
  return (await engine.api.json("GET", "/v1/community-templates", zTemplates)).templates;
}

export interface NewCommunity {
  name: string;
  description: string | null;
  template?: string;
  visibility?: "private" | "public";
  joinPolicy?: "invite" | "open";
}

export async function createCommunity(engine: Engine, c: NewCommunity, reqId: string): Promise<Org> {
  const { org } = await engine.api.json("POST", "/v1/orgs", z.object({ org: zOrg }), {
    body: {
      name: c.name.trim(),
      description: c.description?.trim() || null,
      requestId: reqId,
      kind: "community",
      ...(c.template ? { template: c.template } : {}),
      ...(c.visibility ? { visibility: c.visibility } : {}),
      ...(c.joinPolicy ? { joinPolicy: c.joinPolicy } : {}),
    },
  });
  engine.signals.track("community.created");
  await engine.refreshAll();
  return org;
}

/** Who may find and join it, and its rules (people who can edit the community). */
export async function updateCommunityAccess(engine: Engine, orgId: string, change: { visibility?: "private" | "public"; joinPolicy?: "invite" | "open"; rules?: string | null }): Promise<void> {
  await engine.api.call("PATCH", `/v1/orgs/${enc(orgId)}`, { body: change });
  await engine.refreshAll();
}

export async function discover(engine: Engine, q: string, cursor = 0): Promise<{ communities: Discovered[]; nextCursor: number | null }> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim().slice(0, 60));
  if (cursor) params.set("cursor", String(cursor));
  const qs = params.toString();
  return engine.api.json("GET", `/v1/communities/discover${qs ? `?${qs}` : ""}`, zDiscoverPage);
}

export function communityPreview(engine: Engine, id: string): Promise<CommunityPreview> {
  return engine.api.json("GET", `/v1/communities/${enc(id)}/preview`, zPreview);
}

export async function joinCommunity(engine: Engine, id: string): Promise<Org> {
  const { org } = await engine.api.json("POST", `/v1/communities/${enc(id)}/join`, zJoined);
  await engine.refreshAll();
  return org;
}

export async function applyToJoin(engine: Engine, id: string, answers: string[]): Promise<JoinApplication> {
  return (await engine.api.json("POST", `/v1/communities/${enc(id)}/apply`, zApplicationOut, { body: { answers } })).application;
}

export async function withdrawApplication(engine: Engine, applicationId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/applications/${enc(applicationId)}`);
}

// ───────────── moderation ─────────────

export async function bans(engine: Engine, orgId: string): Promise<Ban[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/bans`, zBans)).bans;
}

/** Bans someone (a member is removed at once); they can't come back by invitation or open joining until unbanned. */
export async function ban(engine: Engine, orgId: string, userId: string, reason: string | null): Promise<void> {
  await engine.api.call("POST", `/v1/orgs/${enc(orgId)}/bans`, { body: { userId, reason: reason?.trim() || null } });
}

export async function unban(engine: Engine, orgId: string, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/bans/${enc(userId)}`);
}

/** Times a member out until [until] (at most 28 days), or ends it (null). */
export async function setTimeout_(engine: Engine, orgId: string, userId: string, until: number | null, reason: string | null): Promise<number | null> {
  const r = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/members/${enc(userId)}/timeout`, z.object({ timeoutUntil: z.number().nullish() }), {
    body: { until, reason: reason?.trim() || null },
  });
  return r.timeoutUntil ?? null;
}

/** Pauses joining and new DMs between members (null resumes), and turns activity alerts on or off. */
export async function setSecurity(engine: Engine, orgId: string, change: { invitesPausedUntil?: number | null; dmsPausedUntil?: number | null; activityAlerts?: boolean }): Promise<SecurityState> {
  const r = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/security`, zSecurity, { body: change });
  await engine.refreshAll();
  return r;
}

export async function setJoinQuestions(engine: Engine, orgId: string, questions: string[] | null): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/application`, { body: { questions } });
  await engine.refreshAll();
}

export async function applications(engine: Engine, orgId: string, status: "pending" | "closed"): Promise<{ applications: JoinApplication[]; pending: number }> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/applications?status=${status}`, zApplications);
}

export async function answerApplication(engine: Engine, id: string, status: "approved" | "denied", note: string | null): Promise<JoinApplication> {
  return (await engine.api.json("PATCH", `/v1/applications/${enc(id)}`, zApplicationOut, { body: { status, ...(note?.trim() ? { note: note.trim() } : {}) } })).application;
}
