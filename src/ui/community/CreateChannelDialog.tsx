import { Hash, Megaphone, MessagesSquare, Volume2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { ApiError } from "../../api/client";
import type { Category } from "../../api/communitySchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { createCommunityChannel, setOverwrite } from "../../sync/community";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { accessRule, type ChannelType, channelRequest, privacyRule } from "../../sync/communityRules";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
import { ChannelOptionsFields, type ChannelOptionsDraft, NO_OPTIONS, RoleChips, useRoleChoices } from "./ChannelOptionsFields";

const TYPES: { type: ChannelType; label: string; hint: string; icon: ReactNode }[] = [
  { type: "text", label: "Text", hint: "Messages, pictures, files and threads", icon: <Hash size={18} aria-hidden /> },
  { type: "voice", label: "Voice", hint: "Drop in to talk, without ringing anyone", icon: <Volume2 size={18} aria-hidden /> },
  { type: "forum", label: "Discussion", hint: "Posts with a title, each with its own replies", icon: <MessagesSquare size={18} aria-hidden /> },
  { type: "announcement", label: "Announcement", hint: "Only people who may announce can post", icon: <Megaphone size={18} aria-hidden /> },
];

interface CreateChannelDialogProps {
  orgId: string;
  categories: Category[];
  categoryId: string | null;
  canCreateTop: boolean;
  onClose: () => void;
}

/**
 * Create channel (the reference's dialog; android ChannelEditSheets): the type tiles, its name, topic and category,
 * Private with the roles who can see it, and with community-permissions read-only (who can post), slowmode and Stage.
 */
export function CreateChannelDialog({ orgId, categories, categoryId, canCreateTop, onClose }: CreateChannelDialogProps) {
  const engine = useEngine();
  const parity = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.permissions) ?? false);
  const slowmode = useOrbit((s) => s.server?.features.includes("slowmode") ?? false);
  const roles = useRoleChoices(orgId, parity);
  const places = categories.filter((c) => c.canCreateChannels);
  const [type, setType] = useState<ChannelType>("text");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [access, setAccess] = useState<string[]>([]);
  const [options, setOptions] = useState<ChannelOptionsDraft>(NO_OPTIONS);
  const [category, setCategory] = useState<string | null>(categoryId ?? (canCreateTop ? null : (places[0]?.id ?? null)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholder = type === "voice" ? "Gaming Lounge" : "new-channel";
  // Private with roles: everyone else is kept out by the channel's own permissions, as the reference does.
  const byRoles = parity && isPrivate && access.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/^#/, "");
    if (!clean) return setError("Give the channel a name.");
    setBusy(true);
    setError(null);
    try {
      const req = channelRequest(type, isPrivate && !byRoles);
      const text = type === "text";
      const opts = parity
        ? type === "voice"
          ? { stage: options.stage }
          : text
            ? { readOnly: options.readOnly, posterRoleIds: options.readOnly ? options.posterRoleIds : [], ...(slowmode ? { slowmodeSec: options.slowmodeSec } : {}) }
            : undefined
        : undefined;
      const ch = await createCommunityChannel(engine, orgId, { name: clean, topic: topic || null, categoryId: category, ...req, ...(opts ? { options: opts } : {}) });
      if (byRoles) {
        const target = { type: "channel" as const, id: ch.id };
        const hide = privacyRule([], true);
        await setOverwrite(engine, orgId, target, hide.subject, hide.allow, hide.deny);
        for (const roleId of access) {
          const rule = accessRule([], roleId, true);
          await setOverwrite(engine, orgId, target, rule.subject, rule.allow, rule.deny);
        }
      }
      onClose();
      navigate({ section: "home", conversationId: ch.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the channel.");
    } finally {
      setBusy(false);
    }
  };

  const where = categories.find((c) => c.id === category)?.name;
  return (
    <Dialog title={where ? `Create channel in ${where}` : "Create channel"} onClose={onClose} wide>
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
          <input id="cc-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={placeholder} />
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
              <small>
                {parity
                  ? "Only the roles you pick can see it. Owners and community managers always can."
                  : "Only the people you add can see it. Category permissions never add anyone to a private channel."}
              </small>
            </span>
            <Toggle checked={isPrivate} onChange={setPrivate} label="Private channel" />
          </div>
        )}
        {parity && isPrivate && type !== "announcement" && (
          <div className="field">
            <span>Who can access this channel?</span>
            <RoleChips label="Who can access this channel" roles={roles} picked={access} onChange={setAccess} />
          </div>
        )}
        {parity && (type === "text" || type === "voice") && <ChannelOptionsFields value={options} onChange={setOptions} voice={type === "voice"} roles={roles} full={false} slowmode={slowmode} />}
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
