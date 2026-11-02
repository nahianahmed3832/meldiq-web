import { z } from "zod";
import { openEnum } from "../api/enums";
import type { Engine } from "./engine";

/**
 * Creators (API 0.65.0 batch B, server docs/SETTINGS_PARITY_API.md): verifying a channel you run elsewhere (an operator
 * checks a screenshot; approved, you get the Creator badge), and the creator programme, where verified creators send
 * links to what they made about Meldiq. The server pays nothing: an operator may write a reward note, and that's all.
 */

export const CREATOR_PLATFORMS = ["youtube", "tiktok", "twitch", "instagram", "x"] as const;
export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];
export const PLATFORM_LABEL: Record<CreatorPlatform, string> = { youtube: "YouTube", tiktok: "TikTok", twitch: "Twitch", instagram: "Instagram", x: "X" };

const zPlatform = openEnum(CREATOR_PLATFORMS);
const zStatus = openEnum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof zStatus>;

export const zCreatorApplication = z.object({
  id: z.string(),
  platform: zPlatform,
  channelName: z.string(),
  link: z.string(),
  notes: z.string().nullable(),
  status: zStatus,
  reason: z.string().nullable(),
  createdAt: z.number(),
  reviewedAt: z.number().nullable(),
});
export type CreatorApplication = z.infer<typeof zCreatorApplication>;

export const zCreatorVerification = z.object({
  codeLine: z.string().nullable(),
  rules: z.object({
    minFollowers: z.number().int(),
    nameMatches: z.array(z.string()),
    platforms: z.array(zPlatform),
    notesMax: z.number().int(),
    proofMaxBytes: z.number().int(),
    proofTypes: z.array(z.string()),
  }),
  verified: z.boolean(),
  applications: z.array(zCreatorApplication),
});
export type CreatorVerification = z.infer<typeof zCreatorVerification>;

export const zCreatorPost = z.object({
  id: z.string(),
  url: z.string(),
  platform: zPlatform,
  views: z.number().nullable(),
  counted: z.boolean(),
  rewardNote: z.string().nullable(),
  createdAt: z.number(),
  reviewedAt: z.number().nullable(),
});
export type CreatorPost = z.infer<typeof zCreatorPost>;

const zProgramApplication = z.object({ id: z.string(), status: zStatus, reason: z.string().nullable(), createdAt: z.number(), reviewedAt: z.number().nullable() });

export const zCreatorProgram = z.object({
  steps: z.object({ verified: z.boolean(), applied: z.boolean(), approved: z.boolean() }),
  application: zProgramApplication.nullable(),
  posts: z.array(zCreatorPost),
});
export type CreatorProgram = z.infer<typeof zCreatorProgram>;

/** The verification form as typed; the server checks it again. */
export interface VerificationForm {
  platform: CreatorPlatform;
  channelName: string;
  link: string;
  notes: string;
  bioLineConfirmed: boolean;
}

/** The form as the query string the upload carries (the screenshot is the body); empty notes are left out. */
export function verificationQuery(f: VerificationForm): string {
  const q = new URLSearchParams({ platform: f.platform, channelName: f.channelName.trim(), link: f.link.trim() });
  if (f.notes.trim()) q.set("notes", f.notes.trim());
  if (f.bioLineConfirmed) q.set("bioLineConfirmed", "true");
  return q.toString();
}

/** What's wrong with the form before sending, or null. */
export function verificationFormProblem(f: VerificationForm, notesMax: number): string | null {
  if (f.channelName.trim().length < 2) return "Give your channel's name.";
  if (!/^https:\/\/[^\s/$.?#]\S*$/i.test(f.link.trim())) return "The link to your channel starts with https://.";
  if (f.notes.trim().length > notesMax) return `Notes can be up to ${notesMax} characters.`;
  if (!f.bioLineConfirmed) return "Put the code line in your channel's bio, then tick the box.";
  return null;
}

/** Checks the screenshot's type and size against the rules the server sent. Null when fine. */
export function proofProblem(file: { type: string; size: number }, rules: { proofTypes: string[]; proofMaxBytes: number }): string | null {
  if (!rules.proofTypes.includes(file.type)) return "The screenshot must be a PNG, JPEG or WebP image.";
  if (file.size > rules.proofMaxBytes) return `The screenshot can be up to ${Math.round(rules.proofMaxBytes / (1024 * 1024))} MB.`;
  if (file.size === 0) return "That file is empty.";
  return null;
}

export function creatorVerification(engine: Engine): Promise<CreatorVerification> {
  return engine.api.json("GET", "/v2/creators/verification", zCreatorVerification);
}

/** Sends the application: the form in the query, the screenshot as the body (the way decorations are sent). */
export async function applyForVerification(engine: Engine, form: VerificationForm, proof: Uint8Array): Promise<CreatorApplication> {
  return (await engine.api.json("POST", `/v2/creators/verification?${verificationQuery(form)}`, z.object({ application: zCreatorApplication }), { raw: proof })).application;
}

export function creatorProgram(engine: Engine): Promise<CreatorProgram> {
  return engine.api.json("GET", "/v2/creators/program", zCreatorProgram);
}

export async function applyToProgram(engine: Engine): Promise<void> {
  await engine.api.call("POST", "/v2/creators/program/apply");
}

/** Sends a link to something you made; views are optional and the server counts nothing by itself. */
export async function sendCreatorPost(engine: Engine, post: { url: string; platform: CreatorPlatform; views?: number }): Promise<CreatorPost> {
  return (await engine.api.json("POST", "/v2/creators/posts", z.object({ post: zCreatorPost }), { body: post })).post;
}

/** A views field as typed: empty is "not given", anything else must be a whole number. */
export function parseViews(raw: string): number | undefined | null {
  const t = raw.trim().replace(/[ ,_]/g, "");
  if (!t) return undefined;
  return /^\d{1,11}$/.test(t) ? Number(t) : null;
}
