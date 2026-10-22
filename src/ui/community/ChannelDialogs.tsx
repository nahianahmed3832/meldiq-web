import { Hash, Lock, Megaphone, MessagesSquare, Plus, Trash2, Volume2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { ApiError } from "../../api/client";
import type { Category } from "../../api/communitySchemas";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { createCommunityChannel, deleteChannel, saveLayout, updateChannel } from "../../sync/community";
import { type ChannelType, channelRequest, channelTypeOf, deleteConfirmed, moveToCategory, SLOWMODE_CHOICES } from "../../sync/communityRules";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const TYPES: { type: ChannelType; label: string; hint: string; icon: ReactNode }[] = [
  { type: "text", label: "Text", hint: "Messages, pictures, files and threads", icon: <Hash size={18} aria-hidden /> },
  { type: "announcement", label: "Announcement", hint: "Only people who may announce can post", icon: <Megaphone size={18} aria-hidden /> },
  { type: "forum", label: "Forum", hint: "Posts with a title, each with its own replies", icon: <MessagesSquare size={18} aria-hidden /> },
  { type: "voice", label: "Voice", hint: "Drop in to talk, without ringing anyone", icon: <Volume2 size={18} aria-hidden /> },
];

export function ChannelGlyph({ kind, voice, format, size = 16 }: { kind: string | null; voice: boolean; format: string; size?: number }) {
  const t = channelTypeOf(kind, voice, format);
  if (t === "voice") return <Volume2 size={size} />;
  if (t === "forum") return <MessagesSquare size={size} />;
  if (t === "announcement") return <Megaphone size={size} />;
  return kind === "PRIVATE" ? <Lock size={size - 1} /> : <Hash size={size} />;
}

/** Create channel (android ChannelEditSheets): its type, name, topic, private or not, and the category it goes into. */
export function CreateChannelDialog(props: { orgId: string; categories: Category[]; categoryId: string | null; canCreateTop: boolean; onClose: () => void }) {
  const { orgId, categories, categoryId, canCreateTop, onClose } = props;
  const engine = useEngine();
  const places = categories.filter((c) => c.canCreateChannels);
  const [type, setType] = useState<ChannelType>("text");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [category, setCategory] = useState<string | null>(categoryId ?? (canCreateTop ? null : (places[0]?.id ?? null)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/^#/, "");
    if (!clean) return setError("Give the channel a name.");
    setBusy(true);
    setError(null);
    try {
      const req = channelRequest(type, isPrivate);
      const ch = await createCommunityChannel(engine, orgId, { name: clean, topic: topic || null, categoryId: category, ...req });
      onClose();
      navigate({ section: "home", conversationId: ch.id });
    } catch (err) {
      setError(errorText(err, "Couldn't create the channel."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Create channel" onClose={onClose} wide>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="kind-choice channel-types" role="radiogroup" aria-label="Channel type">
          {TYPES.map((t) => (
            <button key={t.type} type="button" role="radio" aria-checked={type === t.type} className="kind-option" onClick={() => setType(t.type)}>
              {t.icon}
              <span>
                <strong>{t.label}</strong>
                <small>{t.hint}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="cc-name">Name</label>
          <input id="cc-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={type === "voice" ? "Lounge" : "new-channel"} />
        </div>
        <div className="field">
          <label htmlFor="cc-topic">Topic (optional)</label>
          <input id="cc-topic" className="input" value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cc-category">Category</label>
          <select id="cc-category" className="input" value={category ?? ""} onChange={(e) => setCategory(e.target.value || null)}>
            {canCreateTop && <option value="">No category</option>}
            {places.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {type !== "announcement" && (
          <div className="setting">
            <span className="lines">
              <strong>Private channel</strong>
              <small>Only the people you add can see it. Category permissions never add anyone to a private channel.</small>
            </span>
            <Toggle checked={isPrivate} onChange={setPrivate} label="Private channel" />
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create channel"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Edit channel: name, topic, slowmode (text), forum on or off with its tags and post guidelines (B8). */
export function EditChannelDialog({ channel, onClose }: { channel: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const features = useOrbit((s) => s.server?.features ?? []);
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

  return (
    <Dialog title={`Edit #${channel.name ?? "channel"}`} onClose={onClose} wide>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
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
