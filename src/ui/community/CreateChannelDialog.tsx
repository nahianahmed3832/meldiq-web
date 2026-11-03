import { useT as useLocalization } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
const TYPES: {
  type: ChannelType;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    type: "text",
    get label() {
      return uiText("organization.interface.text_71988c4");
    },
    get hint() {
      return uiText("organization.interface.messages_pictures_files_and_threads_eb91ada");
    },
    icon: <Hash size={18} aria-hidden />,
  },
  {
    type: "voice",
    get label() {
      return uiText("auth.interface.voice_87bf2bc");
    },
    get hint() {
      return uiText("organization.interface.drop_in_to_talk_without_ringing_anyone_ff36ba5");
    },
    icon: <Volume2 size={18} aria-hidden />,
  },
  {
    type: "forum",
    get label() {
      return uiText("organization.interface.discussion_5eb6cf6");
    },
    get hint() {
      return uiText("organization.interface.posts_with_a_title_each_with_its_own_replies_cb72b98");
    },
    icon: <MessagesSquare size={18} aria-hidden />,
  },
  {
    type: "rules",
    get label() {
      return uiText("organization.rules_title");
    },
    get hint() {
      return uiText("organization.interface.server_rules_everyone_can_read_only_community_editors_can_post_6878830");
    },
    icon: <BookText size={18} aria-hidden />,
  },
  {
    type: "announcement",
    get label() {
      return uiText("organization.interface.announcement_028cd1c");
    },
    get hint() {
      return uiText("organization.interface.only_people_who_may_announce_can_post_184ca96");
    },
    icon: <Megaphone size={18} aria-hidden />,
  },
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
  const l10n = useLocalization();

  useLocaleRender();
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
    if (!clean) return setError(uiText("organization.interface.give_the_channel_a_name_41bafaa"));
    setBusy(true);
    setError(null);
    try {
      if (type === "rules") {
        const current = await communityRules(engine, orgId);
        if (current.channelId && current.channelId !== pendingRules?.id) {
          throw new Error(uiText("organization.interface.this_server_already_has_a_rules_channel_change_it_in_server_setti_9d43f25"));
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
      setError(err instanceof Error ? err.message : uiText("organization.interface.couldn_t_create_the_channel_13c9ac1"));
    } finally {
      setBusy(false);
    }
  };
  const where = categories.find((c) => c.id === category)?.name;
  return (
    <Dialog title={where ? uiText("organization.interface.create_channel_in_value0_1d2b6a5", { value0: where }) : uiText("organization.interface.create_channel_f0f8831")} onClose={onClose} wide>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="kind-choice channel-types" role="radiogroup" aria-label={uiText("organization.interface.channel_type_33b2179")}>
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
        {canSetRules && currentRulesId && !pendingRules && (
          <p className="hint">
            <Localized k="organization.interface.this_server_already_has_a_rules_channel_manage_it_in_server_setti_71c43ed" />
          </p>
        )}
        {pendingRules && error && (
          <p className="hint">
            <Localized k="organization.interface.the_channel_was_created_retry_to_finish_setting_it_as_the_rules_c_1a79a59" />
          </p>
        )}
        <div className="field">
          <label htmlFor="cc-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input id="cc-name" className="input" data-autofocus disabled={busy || !!pendingRules} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={placeholder} />
        </div>
        <div className="field">
          <label htmlFor="cc-topic">
            <Localized k="organization.interface.topic_optional_5435146" />
          </label>
          <input id="cc-topic" className="input" disabled={busy || !!pendingRules} value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cc-category">
            <Localized k="organization.interface.category_292c06f" />
          </label>
          <select id="cc-category" className="input" disabled={busy || !!pendingRules} value={category ?? ""} onChange={(e) => setCategory(e.target.value || null)}>
            {canCreateTop && (
              <option value="">
                <Localized k="organization.interface.no_category_b91b9ca" />
              </option>
            )}
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
              <strong>
                <Localized k="organization.interface.private_channel_87f9f3b" />
              </strong>
              <small>
                {parity
                  ? uiText("organization.interface.only_the_roles_you_pick_can_see_it_owners_and_community_managers_c101c76")
                  : uiText("organization.interface.only_the_people_you_add_can_see_it_category_permissions_never_add_70dd2f8")}
              </small>
            </span>
            <Toggle checked={isPrivate} onChange={setPrivate} label={uiText("organization.interface.private_channel_87f9f3b")} />
          </div>
        )}
        {parity && isPrivate && !publicOnly && (
          <div className="field">
            <span>
              <Localized k="organization.interface.who_can_access_this_channel_dd89396" />
            </span>
            <RoleChips label={uiText("organization.interface.who_can_access_this_channel_3b49b26")} roles={roles} picked={access} onChange={setAccess} />
          </div>
        )}
        {parity && (type === "text" || type === "voice") && <ChannelOptionsFields value={options} onChange={setOptions} voice={type === "voice"} roles={roles} full={false} slowmode={slowmode} />}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? l10n("auth.signup_busy") : uiText("organization.interface.create_channel_f0f8831")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
