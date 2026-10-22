import { z } from "zod";
import { type Conversation, type Org, type OrgKind, zConversation } from "../api/schemas";
import {
  type DirectoryMember,
  type Invite,
  type InvitePreview,
  type NewInvite,
  type OrgAdminDetail,
  type OrgRole,
  zChannelOut,
  zConversationOut,
  zDirectoryMember,
  zInvite,
  zInvitePreview,
  zNewInvite,
  zOrgAdminDetail,
  zOrgOut,
} from "../api/workspaceSchemas";
import type { Engine } from "./engine";

/**
 * Workspace actions (server/src/routes/orgs.ts, docs/WORKSPACE_ADMINISTRATION.md). Every one is authorised by the
 * server; the interface only offers what the permissions it was sent allow. Changes reach other devices and members as
 * `org.updated` / `conv.updated`, which refresh the engine's state.
 */

const enc = encodeURIComponent;

/** A new form's idempotency key: a retry or a double click creates one workspace, not two. */
export function requestId(): string {
  return crypto.randomUUID();
}

/** [kind] "community" only where the server has communities (an older one would quietly make a team). */
export async function createWorkspace(engine: Engine, name: string, description: string | null, reqId: string, kind: OrgKind = "team"): Promise<Org> {
  const body = { name: name.trim(), description: description?.trim() || null, requestId: reqId, ...(kind === "community" ? { kind } : {}) };
  const { org } = await engine.api.json("POST", "/v1/orgs", zOrgOut, { body });
  engine.signals.track(kind === "community" ? "community.created" : "workspace.created");
  await engine.refreshAll();
  return org;
}

/** Team or community (owners only; the server checks). Only what the apps show first changes. */
export async function setWorkspaceKind(engine: Engine, orgId: string, kind: OrgKind): Promise<Org> {
  const { org } = await engine.api.json("PATCH", `/v1/orgs/${enc(orgId)}`, zOrgOut, { body: { kind } });
  await engine.refreshAll();
  return org;
}

export async function previewInvite(engine: Engine, code: string): Promise<InvitePreview> {
  return engine.api.json("POST", "/v1/invites/preview", zInvitePreview, { body: { code } });
}

export async function acceptInvite(engine: Engine, code: string): Promise<Org> {
  const { org } = await engine.api.json("POST", "/v1/invites/accept", zOrgOut, { body: { code } });
  await engine.refreshAll();
  return org;
}

export async function workspaceDetail(engine: Engine, orgId: string): Promise<OrgAdminDetail> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}`, zOrgAdminDetail);
}

export async function updateWorkspace(engine: Engine, orgId: string, change: { name?: string; description?: string | null }): Promise<void> {
  await engine.api.call("PATCH", `/v1/orgs/${enc(orgId)}`, { body: change });
  await engine.refreshAll();
}

/** The workspace photo as an object URL (members only; the caller revokes it), or null without one. */
export async function workspacePhoto(engine: Engine, orgId: string): Promise<string | null> {
  try {
    const bytes = await engine.api.bytes(`/v1/orgs/${enc(orgId)}/photo`);
    return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }));
  } catch {
    return null;
  }
}

export async function setWorkspacePhoto(engine: Engine, orgId: string, jpeg: Uint8Array): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/photo`, { raw: jpeg });
  await engine.refreshAll();
}

export async function removeWorkspacePhoto(engine: Engine, orgId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/photo`);
  await engine.refreshAll();
}

export async function leaveWorkspace(engine: Engine, orgId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/members/${enc(engine.device.userId)}`);
  await engine.refreshAll();
}

/** Owners only, after typing the workspace's exact name (server/src/routes/orgs.ts › Deleting an organization). */
export async function deleteWorkspace(engine: Engine, orgId: string, confirmName: string, reqId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}`, { body: { confirmName, requestId: reqId } });
  await engine.refreshAll();
}

// ───────────── people ─────────────

export async function directory(engine: Engine, orgId: string, q = ""): Promise<DirectoryMember[]> {
  const query = q.trim() ? `?q=${enc(q.trim().slice(0, 40))}` : "";
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/members${query}`, z.object({ members: z.array(zDirectoryMember) }))).members;
}

export async function changeMember(engine: Engine, orgId: string, userId: string, change: { role?: OrgRole; title?: string | null }): Promise<void> {
  await engine.api.call("PATCH", `/v1/orgs/${enc(orgId)}/members/${enc(userId)}`, { body: change });
}

export async function removeMember(engine: Engine, orgId: string, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/members/${enc(userId)}`);
}

// ───────────── invitations ─────────────

export async function invitations(engine: Engine, orgId: string): Promise<Invite[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/invites`, z.object({ invites: z.array(zInvite) }))).invites;
}

export interface InviteRequest {
  role: Exclude<OrgRole, "OWNER">;
  branchId?: string | null;
  teamId?: string | null;
  maxUses: number;
  expiresInHours: number;
  /** Guest invitations: how many days the membership lasts from joining (round 7; within the workspace's maximum). */
  guestDays?: number | null;
  /** Communities: one of its custom roles the invitation also gives (the inviter must be able to assign it). */
  roleId?: string | null;
}

export async function createInvitation(engine: Engine, orgId: string, r: InviteRequest): Promise<NewInvite> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/invites`, z.object({ invite: zNewInvite }), { body: r })).invite;
}

export async function revokeInvitation(engine: Engine, inviteId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/invites/${enc(inviteId)}`);
}

// ───────────── channels ─────────────

export type ChannelKind = "PUBLIC" | "PRIVATE" | "ANNOUNCEMENT";
export type ChannelScope = "ORG" | "BRANCH" | "TEAM";

/**
 * [voice]: a voice room (API 0.7+, docs/VOICE_ROOMS.md), public or private; the server refuses an announcement one.
 * A public channel is joined by everyone it's for, now and later (android round 7, MELDIQ_CALL_BUGS bug 6): servers up
 * to 0.7.1 stored workspace-wide public channels as opt-in unless `autoJoin` was sent, so members never saw them.
 * Private channels stay invite-only; announcement channels are always joined.
 */
export async function createChannel(
  engine: Engine,
  orgId: string,
  c: { name: string; topic: string | null; scope: ChannelScope; scopeId: string | null; kind: ChannelKind; voice?: boolean },
): Promise<Conversation> {
  const { channel } = await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/channels`, zChannelOut, {
    body: {
      name: c.name.trim(),
      topic: c.topic?.trim() || null,
      scope: c.scope,
      scopeId: c.scopeId,
      kind: c.kind,
      ...(c.kind === "PUBLIC" ? { autoJoin: true } : {}),
      ...(c.voice ? { voice: true } : {}),
    },
  });
  await engine.refreshAll();
  return channel;
}

/** Workspace channels the person may see, archived ones included when asked (managers restore them). */
export async function workspaceChannels(engine: Engine, orgId: string, includeArchived: boolean): Promise<Conversation[]> {
  const q = includeArchived ? "?includeArchived=true" : "";
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/channels${q}`, z.object({ channels: z.array(zConversation) }))).channels;
}

export async function updateConversation(engine: Engine, id: string, change: { name?: string; topic?: string | null; archived?: boolean; kind?: ChannelKind }): Promise<Conversation> {
  const { conversation } = await engine.api.json("PATCH", `/v1/conversations/${enc(id)}`, zConversationOut, { body: change });
  await engine.refreshAll();
  return conversation;
}

export async function createGroup(engine: Engine, name: string, memberIds: string[]): Promise<Conversation> {
  const { conversation } = await engine.api.json("POST", "/v1/conversations/group", zConversationOut, { body: { name: name.trim(), memberIds } });
  await engine.ensureConversation(conversation.id);
  return conversation;
}

export async function addConversationMember(engine: Engine, id: string, userId: string): Promise<void> {
  await engine.api.call("PUT", `/v1/conversations/${enc(id)}/members/${enc(userId)}`, { body: { role: "MEMBER" } });
}

export async function removeConversationMember(engine: Engine, id: string, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/conversations/${enc(id)}/members/${enc(userId)}`);
}
