import { BookText, Hash, Megaphone, MessagesSquare, Volume2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { Conversation } from "../../api/schemas";
import type { Category } from "../../api/communitySchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { createCommunityChannel, setOverwrite } from "../../sync/community";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { accessRule, type ChannelType, channelRequest, privacyRule } from "../../sync/communityRules";
import { communityRules, RULES_FEATURE, saveCommunityRules } from "../../sync/rulesChannel";
import { useCommunityAccess } from "./useCommunityAccess";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
import { ChannelOptionsFields, type ChannelOptionsDraft, NO_OPTIONS, RoleChips, useRoleChoices } from "./ChannelOptionsFields";

const TYPES: { type: ChannelType; label: string; hint: string; icon: ReactNode }[] = [
  { type: "text", label: "Text", hint: "Messages, pictures, files and threads", icon: <Hash size={18} aria-hidden /> },
  { type: "voice", label: "Voice", hint: "Drop in to talk, without ringing anyone", icon: <Volume2 size={18} aria-hidden /> },
  { type: "forum", label: "Discussion", hint: "Posts with a title, each with its own replies", icon: <MessagesSquare size={18} aria-hidden /> },
  { type: "rules", label: "Rules", hint: "Server rules everyone can read; only community editors can post", icon: <BookText size={18} aria-hidden /> },
  { type: "announcement", label: "Announcement", hint: "Only people who may announce can post", icon: <Megaphone size={18} aria-hidden /> },
];

interface CreateChannelDialogProps {
  orgId: string;
  initialType?: ChannelType;
  categories: Category[];
  categoryId: string | null;
  canCreateTop: boolean;
  onClose: () => void;
}

/**
 * Create channel (the reference's dialog; android ChannelEditSheets): the type tiles, its name, topic and category,
 * Private with the roles who can see it, and with community-permissions read-only (who can post), slowmode and Stage.
 */
export function CreateChannelDialog({ orgId, initialType = "text", categories, categoryId, canCreateTop, onClose }: CreateChannelDialogProps) {
  const engine = useEngine();
  const parity = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.permissions) ?? false);
  const slowmode = useOrbit((s) => s.server?.features.includes("slowmode") ?? false);
  const rulesSupported = useOrbit((s) => s.server?.features.includes(RULES_FEATURE) ?? false);
  const currentRulesId = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.rulesChannel?.channelId);
  const communityAccess = useCommunityAccess(orgId);
  const canSetRules = rulesSupported && !!communityAccess && (communityAccess.isOwner || communityAccess.effective.includes("workspace.edit"));
  // Keep the new channel across a failed rules save so retrying never creates a duplicate.
  const [pendingRules, setPendingRules] = useState<Conversation | null>(null);
  const roles = useRoleChoices(orgId, parity);
  const places = categories.filter((c) => c.canCreateChannels);
  const [type, setType] = useState<ChannelType>(initialType);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [access, setAccess] = useState<string[]>([]);
  const [options, setOptions] = useState<ChannelOptionsDraft>(NO_OPTIONS);
  const [category, setCategory] = useState<string | null>(categoryId ?? (canCreateTop ? null : (places[0]?.id ?? null)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholder = type === "rules" ? "rules" : type === "voice" ? "Gaming Lounge" : "new-channel";
  const publicOnly = type === "announcement" || type === "rules";
  // Private with roles: everyone else is kept out by the channel's own permissions, as the reference does.
  const byRoles = !publicOnly && parity && isPrivate && access.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const clean = name.trim().replace(/^#/, "");
    if (!clean) return setError("Give the channel a name.");
    setBusy(true);
    setError(null);
    try {
      if (type === "rules") {
        const current = await communityRules(engine, orgId);
        if (current.channelId && current.channelId !== pendingRules?.id) {
          throw new Error("This server already has a rules channel. Change it in Server Settings → Rules.");
        }
        const ch =
          pendingRules ??
          (await createCommunityChannel(engine, orgId, {
            name: clean,
            topic: topic || null,
            categoryId: category,
            ...channelRequest("rules", false),
            ...(parity ? { options: { readOnly: true, posterRoleIds: [] } } : {}),
          }));
        setPendingRules(ch);
        await saveCommunityRules(engine, orgId, {
          channelId: ch.id,
          required: current.required,
          rules: current.rules.map((r) => ({ ...r, description: r.description ?? "" })),
        });
        await engine.community.refresh(orgId);
        onClose();
        navigate({ section: "home", conversationId: ch.id });
        return;
      }
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
      setError(err instanceof Error ? err.message : "Couldn't create the channel.");
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
          {TYPES.filter((t) => t.type !== "rules" || canSetRules).map((t) => (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={type === t.type}
              className="kind-option"
              disabled={busy || !!pendingRules || (t.type === "rules" && !!currentRulesId)}
              onClick={() => setType(t.type)}
            >
              {t.icon}
              <span>
                <strong>{t.label}</strong>
                <small>{t.hint}</small>
              </span>
            </button>
          ))}
        </div>
        {canSetRules && currentRulesId && !pendingRules && <p className="hint">This server already has a rules channel. Manage it in Server Settings → Rules.</p>}
        {pendingRules && error && <p className="hint">The channel was created. Retry to finish setting it as the rules channel, or select it in Server Settings → Rules.</p>}
        <div className="field">
          <label htmlFor="cc-name">Name</label>
          <input id="cc-name" className="input" data-autofocus disabled={busy || !!pendingRules} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={placeholder} />
        </div>
        <div className="field">
          <label htmlFor="cc-topic">Topic (optional)</label>
          <input id="cc-topic" className="input" disabled={busy || !!pendingRules} value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cc-category">Category</label>
          <select id="cc-category" className="input" disabled={busy || !!pendingRules} value={category ?? ""} onChange={(e) => setCategory(e.target.value || null)}>
            {canCreateTop && <option value="">No category</option>}
            {places.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {!publicOnly && (
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
        {parity && isPrivate && !publicOnly && (
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
