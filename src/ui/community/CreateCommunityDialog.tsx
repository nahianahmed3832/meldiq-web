import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { communityTemplates, createCommunity } from "../../sync/community";
import { requestId } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";
import type { DiscordReturn } from "../../application/discordReturn";
import { DiscordImport } from "./DiscordImport";
import { DISCOVERY_FEATURES, templateFromText, templateLink } from "../../sync/discovery/rules";
/** The starter templates' names and what they're for (android CommunityTemplates; ids from the server). */
const TEMPLATE_TEXT: Record<
  string,
  {
    name: string;
    hint: string;
  }
> = {
  starter: {
    get name() {
      return uiText("organization.interface.starter_262b4ff");
    },
    get hint() {
      return uiText("organization.interface.welcome_announcements_general_chat_introductions_and_a_lounge_bdc46b3");
    },
  },
  friends: {
    get name() {
      return uiText("workspace.friends");
    },
    get hint() {
      return uiText("organization.interface.general_chat_photos_plans_and_a_voice_hangout_2212f85");
    },
  },
  gaming: {
    get name() {
      return uiText("organization.interface.gaming_0fadfa2");
    },
    get hint() {
      return uiText("organization.interface.looking_for_group_a_clips_forum_and_two_voice_channels_5a54ca0");
    },
  },
  study: {
    get name() {
      return uiText("organization.interface.study_group_aeb1c77");
    },
    get hint() {
      return uiText("organization.interface.homework_help_a_resources_forum_and_a_study_room_7ab2263");
    },
  },
  club: {
    get name() {
      return uiText("organization.interface.club_72e81fe");
    },
    get hint() {
      return uiText("organization.interface.introductions_an_ideas_forum_and_a_meeting_room_0624245");
    },
  },
};
/**
 * Start a community (batch B2 starter templates, android CreateCommunitySheet): name, description, a template whose
 * categories and channels the server creates, and whether it's listed in Discover and open to join.
 */
interface CreateCommunityDialogProps {
  onClose: () => void;
  discord?: DiscordReturn | null;
  /** Community parity E: a pasted template link opens its preview instead. */
  onTemplate?: (code: string) => void;
}
export function CreateCommunityDialog({ onClose, discord = null, onTemplate }: CreateCommunityDialogProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const canImport = useOrbit((s) => s.server?.features.includes("discord-import") ?? false);
  const [tab, setTab] = useState<"new" | "discord">(discord ? "discord" : "new");
  const reqId = useMemo(requestId, []);
  const hasTemplates = useOrbit((s) => s.server?.features.includes("community-templates") ?? false);
  const templateLinks = useOrbit((s) => s.server?.features.includes(DISCOVERY_FEATURES.templates) ?? false);
  const templates = useLoad(() => (hasTemplates ? communityTemplates(engine) : Promise.resolve([])), [engine, hasTemplates]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("starter");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [joinPolicy, setJoinPolicy] = useState<"invite" | "open">("invite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = templates.data?.find((t) => t.id === template);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(uiText("organization.interface.give_the_community_a_name_789d631"));
    setBusy(true);
    setError(null);
    try {
      const org = await createCommunity(
        engine,
        { name, description: description || null, template: hasTemplates ? template : undefined, visibility, joinPolicy: visibility === "public" ? joinPolicy : "invite" },
        reqId,
      );
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "home" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : uiText("organization.interface.couldn_t_create_the_community_1d96bd2"));
    } finally {
      setBusy(false);
    }
  };
  const tabs = canImport && (
    <div className="segmented create-tabs" role="tablist" aria-label={uiText("organization.interface.how_to_start_69f3633")}>
      <button type="button" role="tab" aria-selected={tab === "new"} aria-pressed={tab === "new"} onClick={() => setTab("new")}>
        <Localized k="organization.interface.new_community_3d86379" />
      </button>
      <button type="button" role="tab" aria-selected={tab === "discord"} aria-pressed={tab === "discord"} onClick={() => setTab("discord")}>
        <Localized k="organization.interface.import_from_discord_47d6de1" />
      </button>
    </div>
  );
  if (tab === "discord" && canImport) {
    return (
      <Dialog
        title={uiText("organization.interface.import_from_discord_47d6de1")}
        subtitle={uiText("organization.interface.channels_categories_roles_emoji_and_the_icon_come_over_people_joi_26ee27a")}
        onClose={onClose}
        wide
        className="create-dialog"
      >
        <div className="dialog-body">
          {tabs}
          <DiscordImport returned={discord} onClose={onClose} />
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog
      title={l10n("workspace.home_start_community")}
      subtitle={uiText("organization.interface.your_place_to_hang_out_with_friends_your_team_or_your_fans_ada1f33")}
      onClose={onClose}
      wide
      className="create-dialog"
    >
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {tabs}
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cc-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input
            id="cc-name"
            className="input"
            data-autofocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={uiText("organization.interface.dhaka_makers_8027676")}
          />
        </div>
        <div className="field">
          <label htmlFor="cc-desc">
            <Localized k="organization.interface.description_optional_f6cbe2f" />
          </label>
          <input id="cc-desc" className="input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {hasTemplates && (
          <div className="field">
            <span className="label">
              <Localized k="organization.interface.start_with_a78c1db" />
            </span>
            <div className="kind-choice template-choice" role="radiogroup" aria-label={uiText("organization.interface.template_0575f29")}>
              {(templates.data ?? []).map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={template === t.id} className="kind-option" onClick={() => setTemplate(t.id)}>
                  <span>
                    <strong>{TEMPLATE_TEXT[t.id]?.name ?? t.id}</strong>
                    <small>{TEMPLATE_TEXT[t.id]?.hint ?? t.categories.map((c) => c.name).join(", ")}</small>
                  </span>
                </button>
              ))}
            </div>
            {chosen && <span className="hint">{chosen.categories.map((c) => `${c.name}: ${c.channels.map((ch) => (ch.voice ? ch.name : `#${ch.name}`)).join(", ")}`).join(" · ")}</span>}
          </div>
        )}
        {templateLinks && onTemplate && <TemplateLinkField onTemplate={onTemplate} />}
        <div className="field">
          <span className="label">
            <Localized k="organization.interface.who_can_find_it_df3ff14" />
          </span>
          <div className="segmented" role="radiogroup" aria-label={uiText("organization.interface.who_can_find_it_df3ff14")}>
            <button type="button" role="radio" aria-checked={visibility === "private"} aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}>
              <Localized k="organization.interface.only_people_i_invite_4664a6e" />
            </button>
            <button type="button" role="radio" aria-checked={visibility === "public"} aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}>
              <Localized k="organization.interface.listed_in_discover_39a6a3a" />
            </button>
          </div>
        </div>
        {visibility === "public" && (
          <div className="field">
            <span className="label">
              <Localized k="organization.interface.who_can_join_35c6853" />
            </span>
            <div className="segmented" role="radiogroup" aria-label={uiText("organization.interface.who_can_join_35c6853")}>
              <button type="button" role="radio" aria-checked={joinPolicy === "invite"} aria-pressed={joinPolicy === "invite"} onClick={() => setJoinPolicy("invite")}>
                <Localized k="organization.interface.with_an_invitation_5a42cd4" />
              </button>
              <button type="button" role="radio" aria-checked={joinPolicy === "open"} aria-pressed={joinPolicy === "open"} onClick={() => setJoinPolicy("open")}>
                <Localized k="organization.interface.anyone_8d486bb" />
              </button>
            </div>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Users size={16} /> {busy ? l10n("auth.signup_busy") : uiText("organization.interface.create_community_5d6da55")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** "Have a template link?": a pasted link (or code) opens that template's preview. */
function TemplateLinkField({ onTemplate }: { onTemplate: (code: string) => void }) {
  useLocaleRender();
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const open = () => {
    const code = templateFromText(text);
    if (!code) return setProblem(uiText("organization.interface.that_isn_t_a_template_link_template_links_look_like_value0_905bbad", { value0: templateLink("ABCD1234EFGH") }));
    onTemplate(code);
  };
  return (
    <div className="field">
      <label htmlFor="cc-template">
        <Localized k="organization.interface.or_start_from_a_template_link_f3c85ec" />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <input
          id="cc-template"
          className="input grow"
          value={text}
          placeholder={uiText("organization.interface.paste_a_template_link_dc8cec7")}
          onChange={(e) => {
            setText(e.target.value);
            setProblem(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            open();
          }}
        />
        <button type="button" className="btn btn-secondary btn-sm" disabled={!text.trim()} onClick={open}>
          <Localized k="organization.interface.use_template_351dd54" />
        </button>
      </div>
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
