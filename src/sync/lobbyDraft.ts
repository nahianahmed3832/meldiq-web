import {
  LOBBY_LIMITS,
  type LobbyBoard,
  type LobbyButton,
  type LobbyChannel,
  type LobbyFaqItem,
  type LobbyLook,
  type LobbySection,
  type LobbySectionKey,
  type LobbySettings,
  type LobbyView,
} from "../api/lobbySchemas";

/**
 * The lobby's live editor works on a draft: a copy of the settings that the page renders as it changes, saved in one
 * PUT with only the fields that differ. Everything here is pure (no engine), so it's tested on its own.
 */

export type LookField = keyof LobbyLook;
const LOOK_FIELDS: readonly LookField[] = ["layout", "accent", "background", "cards", "font", "bannerHeight", "title"];
type Field = "enabled" | "tagline" | "buttons" | "about" | "mainChannelIds" | "faq" | "showWhoRunsIt" | "sections" | "leaderboards";
const FIELDS: readonly Field[] = ["enabled", "tagline", "buttons", "about", "mainChannelIds", "faq", "showWhoRunsIt", "sections", "leaderboards"];

/** What PUT /v1/orgs/:orgId/lobby/settings takes: the revision, and only the fields that changed. */
export interface LobbySettingsBody {
  rev: number;
  enabled?: boolean;
  tagline?: string | null;
  buttons?: { label: string; url?: string; channelId?: string }[];
  about?: string | null;
  mainChannelIds?: string[];
  faq?: { id?: string; question: string; answer: string }[];
  showWhoRunsIt?: boolean;
  look?: Partial<LobbyLook>;
  sections?: LobbySection[];
  leaderboards?: LobbyBoard[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The fields that differ between the saved settings and the draft (look fields one by one). */
export function changedFields(saved: LobbySettings, draft: LobbySettings): string[] {
  const top = FIELDS.filter((f) => !same(clean(saved)[f], clean(draft)[f]));
  const look = LOOK_FIELDS.filter((f) => saved.look[f] !== draft.look[f]).map((f) => `look.${f}`);
  return [...top, ...look];
}

/** The footer's "N changes". */
export const changeCount = (saved: LobbySettings, draft: LobbySettings): number => changedFields(saved, draft).length;

/** The draft as it would be saved: text trimmed, blank buttons and questions left out. */
export function clean(d: LobbySettings): LobbySettings {
  return {
    ...d,
    tagline: d.tagline?.trim() || null,
    about: d.about?.trim() || null,
    buttons: d.buttons
      .filter((b) => b.label.trim() || b.url?.trim() || b.channelId)
      .map((b) => ({ label: b.label.trim(), url: b.channelId ? null : b.url?.trim() || null, channelId: b.channelId || null })),
    faq: d.faq.filter((q) => q.question.trim() || q.answer.trim()).map((q) => ({ ...q, question: q.question.trim(), answer: q.answer.trim() })),
  };
}

/** The PUT body for the draft: revision [rev] and the changed fields. */
export function settingsBody(saved: LobbySettings, draft: LobbySettings, rev: number): LobbySettingsBody {
  const c = clean(draft);
  const changed = new Set(changedFields(saved, draft));
  const look = LOOK_FIELDS.filter((f) => changed.has(`look.${f}`));
  return {
    rev,
    ...(changed.has("enabled") ? { enabled: c.enabled } : {}),
    ...(changed.has("tagline") ? { tagline: c.tagline } : {}),
    ...(changed.has("buttons") ? { buttons: c.buttons.map((b) => (b.channelId ? { label: b.label, channelId: b.channelId } : { label: b.label, url: b.url ?? "" })) } : {}),
    ...(changed.has("about") ? { about: c.about } : {}),
    ...(changed.has("mainChannelIds") ? { mainChannelIds: c.mainChannelIds } : {}),
    ...(changed.has("faq") ? { faq: c.faq.map((q) => ({ ...(q.id && !q.id.startsWith("new-") ? { id: q.id } : {}), question: q.question, answer: q.answer })) } : {}),
    ...(changed.has("showWhoRunsIt") ? { showWhoRunsIt: c.showWhoRunsIt } : {}),
    ...(look.length ? { look: Object.fromEntries(look.map((f) => [f, c.look[f]])) as Partial<LobbyLook> } : {}),
    ...(changed.has("sections") ? { sections: c.sections } : {}),
    ...(changed.has("leaderboards") ? { leaderboards: c.leaderboards } : {}),
  };
}

const HTTPS = /^https:\/\/\S+$/i;

/** Why the draft can't be saved yet, or null. The server checks everything again. */
export function draftProblem(d: LobbySettings): string | null {
  const c = clean(d);
  if ((c.tagline ?? "").length > LOBBY_LIMITS.tagline) return `Keep the tagline to ${LOBBY_LIMITS.tagline} characters.`;
  if (c.buttons.length > LOBBY_LIMITS.buttons) return `Up to ${LOBBY_LIMITS.buttons} buttons.`;
  for (const [i, b] of c.buttons.entries()) {
    if (!b.label) return `Button ${i + 1} needs a label.`;
    if (b.label.length > LOBBY_LIMITS.buttonLabel) return `Keep button labels to ${LOBBY_LIMITS.buttonLabel} characters.`;
    if (!b.channelId && !b.url) return `Button ${i + 1} needs a link or a channel.`;
    if (!b.channelId && b.url && (!HTTPS.test(b.url) || !URL.canParse(b.url))) return `Button ${i + 1}'s link must start with https://`;
  }
  if ((c.about ?? "").length > LOBBY_LIMITS.about) return `Keep the about text to ${LOBBY_LIMITS.about} characters.`;
  if (c.mainChannelIds.length > LOBBY_LIMITS.mainChannels) return `Pick up to ${LOBBY_LIMITS.mainChannels} main channels.`;
  if (c.faq.length > LOBBY_LIMITS.faq) return `Up to ${LOBBY_LIMITS.faq} questions.`;
  for (const [i, q] of c.faq.entries()) {
    if (!q.question || !q.answer) return `Question ${i + 1} needs both a question and an answer.`;
    if (q.question.length > LOBBY_LIMITS.question || q.answer.length > LOBBY_LIMITS.answer) return `Question ${i + 1} is too long.`;
  }
  if (c.leaderboards.length === 0) return "Keep at least one leaderboard.";
  return null;
}

// ───────────── lists ─────────────

/** [list] with the item at [from] moved to index [to] (clamped); a new array either way. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/** A section dropped before or after another (drag and drop on the page or in the Sections list). */
export function moveSection(sections: readonly LobbySection[], key: LobbySectionKey, target: LobbySectionKey, at: "before" | "after"): LobbySection[] {
  if (key === target) return [...sections];
  const moving = sections.find((s) => s.key === key);
  if (!moving) return [...sections];
  const rest = sections.filter((s) => s.key !== key);
  const i = rest.findIndex((s) => s.key === target);
  if (i < 0) return [...sections];
  // Dropped beside a card in the other column: it joins that column (Classic's main and side).
  const column = rest[i].column;
  const placed = { ...moving, column };
  return [...rest.slice(0, at === "before" ? i : i + 1), placed, ...rest.slice(at === "before" ? i : i + 1)];
}

/** One section changed (shown, column); "who runs it" keeps its switch and showWhoRunsIt together, as the server does. */
export function setSection(d: LobbySettings, key: LobbySectionKey, patch: Partial<Omit<LobbySection, "key">>): LobbySettings {
  const sections = d.sections.map((s) => (s.key === key ? { ...s, ...patch } : s));
  const showWhoRunsIt = key === "who_runs_it" && patch.shown !== undefined ? patch.shown : d.showWhoRunsIt;
  return { ...d, sections, showWhoRunsIt };
}

/** "Show who runs it" from the settings page: the card's switch follows. */
export const setWhoRunsIt = (d: LobbySettings, shown: boolean): LobbySettings => setSection(d, "who_runs_it", { shown });

/** A board turned on (added at the end) or off (never the last one). */
export function toggleBoard(boards: readonly LobbyBoard[], board: LobbyBoard): LobbyBoard[] {
  if (!boards.includes(board)) return [...boards, board];
  return boards.length > 1 ? boards.filter((b) => b !== board) : [...boards];
}

export const blankButton = (): LobbyButton => ({ label: "", url: null, channelId: null });
let faqSeq = 0;
/** A new question; its "new-" id is never sent (the server gives it one). */
export const blankQuestion = (): LobbyFaqItem => ({ id: `new-${++faqSeq}`, question: "", answer: "" });

// ───────────── the page ─────────────

/** Which sections go where: Classic has a side column; the other layouts stack everything in one. */
export function pageColumns(sections: readonly LobbySection[], layout: LobbyLook["layout"]): { main: LobbySection[]; side: LobbySection[] } {
  if (layout !== "classic") return { main: [...sections], side: [] };
  return { main: sections.filter((s) => s.column === "main"), side: sections.filter((s) => s.column === "side") };
}

/**
 * The lobby as the draft would show it: the settings swapped for the draft, main channels and leaderboards following
 * the draft's choices with what's already known about them (a channel's activity, a board's entries).
 */
export function withDraft(view: LobbyView, draft: LobbySettings, channels: ReadonlyMap<string, LobbyChannel>): LobbyView {
  const idsChanged = !same(view.settings.mainChannelIds, draft.mainChannelIds);
  const known = new Map([...channels, ...view.mainChannels.map((c) => [c.id, c] as const)]);
  const mainChannels = !idsChanged ? view.mainChannels : draft.mainChannelIds.map((id) => known.get(id)).filter((c): c is LobbyChannel => !!c);
  const leaderboards = draft.leaderboards.map((board) => view.leaderboards.find((l) => l.board === board) ?? { board, entries: [] });
  return { ...view, settings: draft, mainChannels, mainChannelsPicked: idsChanged ? draft.mainChannelIds.length > 0 : view.mainChannelsPicked, leaderboards };
}

/**
 * A card's state: "ok" with something to show; "empty" when the community hasn't filled it in (an editor's job);
 * "quiet" when it fills itself and nothing is there yet (live rooms, giveaways, the feed, leaderboards). Members only
 * ever see "ok" cards.
 */
export type CardState = "ok" | "empty" | "quiet";

export function cardState(key: LobbySectionKey, v: LobbyView): CardState {
  switch (key) {
    case "about":
      return v.settings.about?.trim() ? "ok" : "empty";
    case "faq":
      return v.settings.faq.some((q) => q.question.trim()) ? "ok" : "empty";
    case "main_channels":
      return v.mainChannels.length ? "ok" : "empty";
    case "live_now":
      return v.liveNow.length ? "ok" : "quiet";
    case "giveaways":
      return v.giveaways.length ? "ok" : "quiet";
    case "feed":
      return v.feed.length ? "ok" : "quiet";
    case "leaderboard":
      return v.leaderboards.some((l) => l.entries.length) ? "ok" : "quiet";
    case "pick_roles":
      return v.pickRoles.prompts.length ? "ok" : "empty";
    case "rules":
      return v.rules ? "ok" : "empty";
    case "who_runs_it":
      return v.whoRunsIt.length ? "ok" : "quiet";
    case "links":
      return v.links.length ? "ok" : "empty";
  }
}

/**
 * Whether nobody has written anything for the lobby yet (no tagline or buttons, About, FAQ or picked channels): the
 * "nothing here yet" card for editors. Cards that fill themselves (the busiest channels, who runs it) may still show.
 */
export function lobbyIsBare(v: LobbyView): boolean {
  const s = v.settings;
  return !s.tagline?.trim() && !s.buttons.some((b) => b.label.trim()) && !s.about?.trim() && !s.faq.some((q) => q.question.trim()) && s.mainChannelIds.length === 0;
}

// ───────────── pick your roles ─────────────

/** Choosing an answer: a one-answer question replaces its choice, others toggle (as onboarding does). */
export function togglePick(chosen: ReadonlySet<string>, prompt: { single: boolean; options: readonly { id: string }[] }, optionId: string): Set<string> {
  const next = new Set(chosen);
  if (next.has(optionId)) next.delete(optionId);
  else {
    if (prompt.single) for (const o of prompt.options) next.delete(o.id);
    next.add(optionId);
  }
  return next;
}

/**
 * What to send to POST …/onboarding/answers (it replaces every answer): the answers given before to questions the
 * lobby doesn't show, plus the lobby's choices.
 */
export function pickRolesAnswer(before: readonly string[], lobbyOptionIds: readonly string[], chosen: ReadonlySet<string>): string[] {
  const shown = new Set(lobbyOptionIds);
  return [...new Set([...before.filter((id) => !shown.has(id)), ...[...chosen].filter((id) => shown.has(id))])];
}
