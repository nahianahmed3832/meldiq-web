import { BookText, Hash, Lock, Megaphone, MessagesSquare, Plus, Trash2, Volume2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import type { Category } from "../../api/communitySchemas";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { deleteChannel, saveLayout, updateChannel } from "../../sync/community";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { channelTypeOf, deleteConfirmed, moveToCategory, SLOWMODE_CHOICES } from "../../sync/communityRules";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
import { type ChannelDialogTab, ChannelDialogTabs } from "./webhooks/ChannelDialogTabs";
import { useWebhooksAllowed } from "./webhooks/useWebhooksAllowed";
import { WebhooksTab } from "./webhooks/WebhooksTab";
import { ChannelOptionsFields, type ChannelOptionsDraft, NO_OPTIONS, useRoleChoices } from "./ChannelOptionsFields";
import { PermissionsBody } from "./PermissionsDialog";

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** A channel's icon; [rules]: the community's rules channel, a book (API 0.65.0). */
export function ChannelGlyph({ kind, voice, format, rules = false, size = 16 }: { kind: string | null; voice: boolean; format: string; rules?: boolean; size?: number }) {
  if (rules) return <BookText size={size} aria-label="Rules" />;
  const t = channelTypeOf(kind, voice, format);
  if (t === "voice") return <Volume2 size={size} />;
  if (t === "forum") return <MessagesSquare size={size} />;
  if (t === "announcement") return <Megaphone size={size} />;
  return kind === "PRIVATE" ? <Lock size={size - 1} /> : <Hash size={size} />;
}

export { CreateChannelDialog } from "./CreateChannelDialog";

/** Edit channel: name, topic, slowmode (text), forum on or off with its tags and post guidelines (B8). */
export function EditChannelDialog({ channel, onClose }: { channel: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const features = useOrbit((s) => s.server?.features ?? []);
  // Community parity A1: the reference's Overview options and a Permissions tab beside it.
  const parity = features.includes(PARITY_FEATURES.permissions) && !!channel.orgId;
  const roles = useRoleChoices(channel.orgId ?? "", parity);
  const [options, setOptions] = useState<ChannelOptionsDraft>(() => ({ ...NO_OPTIONS, ...(channel.options ?? {}), posterRoleIds: channel.options?.posterRoleIds ?? [] }));
  const [name, setName] = useState(channel.name ?? "");
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [slowmode, setSlowmode] = useState(channel.slowmodeSec);
  const [forum, setForum] = useState(channel.format === "forum");
  const [tags, setTags] = useState(channel.forumTags.map((t) => ({ id: t.id as string | undefined, name: t.name })));
  const [newTag, setNewTag] = useState("");
  const [guidelines, setGuidelines] = useState(channel.guidelines ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textChannel = !channel.voice;
  // Community parity C: Webhooks next to the channel's settings, for people who manage them.
  const webhooks = useWebhooksAllowed(channel);
  const [tab, setTab] = useState<ChannelDialogTab>("overview");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("A channel needs a name.");
    setBusy(true);
    setError(null);
    try {
      await updateChannel(engine, channel.id, {
        name: name.trim().replace(/^#/, ""),
        topic: topic.trim() || null,
        ...(features.includes("slowmode") && textChannel ? { slowmodeSec: slowmode } : {}),
        ...(textChannel && features.includes("community-channels") ? { format: forum ? "forum" : "text" } : {}),
        ...(forum && features.includes("forum-tags") ? { forumTags: tags } : {}),
        ...(forum && features.includes("forum-guidelines") ? { guidelines: guidelines.trim() || null } : {}),
        ...(parity
          ? channel.voice
            ? { stage: options.stage }
            : { textOnly: options.textOnly, noGifs: options.noGifs, readOnly: options.readOnly, posterRoleIds: options.readOnly ? options.posterRoleIds : [] }
          : {}),
      });
      onClose();
    } catch (err) {
      setError(errorText(err, "Couldn't save the channel."));
    } finally {
      setBusy(false);
    }
  };

  const addTag = () => {
    const t = newTag.trim().slice(0, 20);
    if (t && !tags.some((x) => x.name.toLowerCase() === t.toLowerCase())) setTags([...tags, { id: undefined, name: t }]);
    setNewTag("");
  };

  // The reference's Overview | Permissions | Webhooks, each where it applies (community parity A1 and C).
  const tabList: ChannelDialogTab[] = ["overview", ...(parity ? (["permissions"] as const) : []), ...(webhooks ? (["webhooks"] as const) : [])];
  return (
    <Dialog title={`Edit #${channel.name ?? "channel"}`} onClose={onClose} wide>
      {tabList.length > 1 && <ChannelDialogTabs tabs={tabList} tab={tab} onTab={setTab} />}
      {tab === "permissions" && channel.orgId && (
        <div className="dialog-body">
          <PermissionsBody orgId={channel.orgId} target={{ type: "channel", id: channel.id }} />
        </div>
      )}
      {webhooks && tab === "webhooks" && channel.orgId && <WebhooksTab channel={channel} orgId={channel.orgId} />}
      <form className="dialog-body" hidden={tab !== "overview"} onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="ec-name">Name</label>
          <input id="ec-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ec-topic">Topic</label>
          <textarea id="ec-topic" className="textarea" rows={2} value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} />
        </div>
        {textChannel && features.includes("slowmode") && (
          <div className="field">
            <label htmlFor="ec-slow">Slowmode</label>
            <select id="ec-slow" className="input" value={slowmode} onChange={(e) => setSlowmode(Number(e.target.value))}>
              {SLOWMODE_CHOICES.map((c) => (
                <option key={c.sec} value={c.sec}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="hint">How long each member waits between messages. People who manage the channel aren't slowed down.</span>
          </div>
        )}
        {parity && (textChannel ? !forum && channel.kind !== "ANNOUNCEMENT" : true) && (
          <ChannelOptionsFields value={options} onChange={setOptions} voice={channel.voice} roles={roles} full slowmode={false} />
        )}
        {textChannel && features.includes("community-channels") && (
          <div className="setting">
            <span className="lines">
              <strong>Forum</strong>
              <small>Posts with a title, each with its own replies. Messages already here stay.</small>
            </span>
            <Toggle checked={forum} onChange={setForum} label="Forum" />
          </div>
        )}
        {forum && features.includes("forum-tags") && (
          <div className="field">
            <label htmlFor="ec-tag">Tags</label>
            <div className="chips">
              {tags.map((t) => (
                <span key={t.name} className="chip">
                  {t.name}
                  <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove tag ${t.name}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <input
                id="ec-tag"
                className="input"
                value={newTag}
                maxLength={20}
                placeholder="Add a tag"
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={addTag} disabled={!newTag.trim() || tags.length >= 20}>
                <Plus size={15} /> Add
              </button>
            </div>
          </div>
        )}
        {forum && features.includes("forum-guidelines") && (
          <div className="field">
            <label htmlFor="ec-guide">Post guidelines</label>
            <textarea id="ec-guide" className="textarea" rows={4} value={guidelines} maxLength={2000} onChange={(e) => setGuidelines(e.target.value)} />
            <span className="hint">Shown at the top of the forum and to everyone writing a post.</span>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Delete a channel for everyone: its name must be typed (android ChannelEditSheets, server confirmName). */
export function DeleteChannelDialog({ orgId, channel, onClose }: { orgId: string; channel: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = channel.name ?? "";
  const ok = deleteConfirmed(name, typed);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteChannel(engine, orgId, channel.id, typed);
      onClose();
      navigate({ section: "home" }, true);
    } catch (e) {
      setError(errorText(e, "Couldn't delete the channel."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={`Delete #${name}?`} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>
          This deletes the channel for everyone, with the server's copies of its messages and files. People keep the messages already on their own devices. It can't be undone.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="dc-name">Type the channel's name to confirm</label>
          <input id="dc-name" className="input" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoComplete="off" />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" disabled={!ok || busy} onClick={() => void run()}>
            <Trash2 size={15} /> {busy ? "Deleting…" : "Delete channel"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Move to: another category (it goes last there), or out of every category. Taking a category's permissions with it. */
export function MoveChannelDialog({
  orgId,
  channel,
  categories,
  siblingsOf,
  onClose,
}: {
  orgId: string;
  channel: Conversation;
  categories: Category[];
  siblingsOf: (categoryId: string | null) => string[];
  onClose: () => void;
}) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = async (to: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const { removed } = await saveLayout(engine, orgId, { channels: moveToCategory(channel.id, to, siblingsOf(to)) });
      if (removed > 0) engine.notice("info", `Moved. ${removed === 1 ? "1 person" : `${removed} people`} lost access with the new category's permissions.`);
      onClose();
    } catch (e) {
      setError(errorText(e, "Couldn't move the channel."));
    } finally {
      setBusy(false);
    }
  };
  const places = [{ id: null as string | null, name: "No category" }, ...categories.map((c) => ({ id: c.id as string | null, name: c.name }))];
  return (
    <Dialog title={`Move #${channel.name ?? "channel"}`} onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          The channel takes the new category's permissions, so who can see it may change. Private channels keep their members.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div style={{ display: "grid", gap: 2 }}>
          {places.map((p) => (
            <button
              key={p.id ?? "none"}
              className="list-row"
              disabled={busy || p.id === channel.categoryId}
              aria-current={p.id === channel.categoryId ? "true" : undefined}
              onClick={() => void move(p.id)}
            >
              <span className="lines">
                <span className="ellipsis">{p.name}</span>
                {p.id === channel.categoryId && <small>Here now</small>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
