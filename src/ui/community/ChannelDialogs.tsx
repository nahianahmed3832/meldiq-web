import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { type ChannelDialogTab, ChannelDialogTabs } from "./webhooks/ChannelDialogTabs";
import { useWebhooksAllowed } from "./webhooks/useWebhooksAllowed";
import { WebhooksTab } from "./webhooks/WebhooksTab";
import { ChannelOptionsFields, type ChannelOptionsDraft, NO_OPTIONS, useRoleChoices } from "./ChannelOptionsFields";
import { PermissionsBody } from "./PermissionsDialog";
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
/** A channel's icon; [rules]: the community's rules channel, a book (API 0.65.0). */
export function ChannelGlyph({ kind, voice, format, rules = false, size = 16 }: { kind: string | null; voice: boolean; format: string; rules?: boolean; size?: number }) {
  useLocaleRender();
  const t = channelTypeOf(kind, voice, format, rules);
  if (t === "rules") return <BookText size={size} aria-label={uiText("organization.rules_title")} />;
  if (t === "voice") return <Volume2 size={size} />;
  if (t === "forum") return <MessagesSquare size={size} />;
  if (t === "announcement") return <Megaphone size={size} />;
  return kind === "PRIVATE" ? <Lock size={size - 1} /> : <Hash size={size} />;
}
export { CreateChannelDialog } from "./CreateChannelDialog";
/** Edit channel: name, topic, slowmode (text), forum on or off with its tags and post guidelines (B8). */
export function EditChannelDialog({ channel, onClose }: { channel: Conversation; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
  const [tags, setTags] = useState(channel.forumTags.map((t) => ({ id: t.id as string | undefined, name: t.name, restricted: t.restricted ?? false })));
  const [requireTag, setRequireTag] = useState(channel.requireForumTag ?? false);
  const [newTag, setNewTag] = useState("");
  const [guidelines, setGuidelines] = useState(channel.guidelines ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textChannel = !channel.voice;
  // Community parity C: Webhooks next to the channel's settings, for people who manage them.
  const webhooks = useWebhooksAllowed(channel);
  const [tab, setTab] = useState<ChannelDialogTab>("overview");
  const originalOptions = { ...NO_OPTIONS, ...(channel.options ?? {}), posterRoleIds: channel.options?.posterRoleIds ?? [] };
  useUnsavedChanges(
    name !== (channel.name ?? "") ||
      topic !== (channel.topic ?? "") ||
      slowmode !== channel.slowmodeSec ||
      forum !== (channel.format === "forum") ||
      guidelines !== (channel.guidelines ?? "") ||
      JSON.stringify(tags) !== JSON.stringify(channel.forumTags.map((t) => ({ id: t.id, name: t.name, restricted: t.restricted ?? false }))) ||
      requireTag !== (channel.requireForumTag ?? false) ||
      JSON.stringify(options) !== JSON.stringify(originalOptions),
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(uiText("organization.interface.a_channel_needs_a_name_8f7d314"));
    setBusy(true);
    setError(null);
    try {
      await updateChannel(engine, channel.id, {
        name: name.trim().replace(/^#/, ""),
        topic: topic.trim() || null,
        ...(features.includes("slowmode") && textChannel ? { slowmodeSec: slowmode } : {}),
        ...(textChannel && features.includes("community-channels") ? { format: forum ? "forum" : "text" } : {}),
        ...(forum && features.includes("forum-tags") ? { forumTags: tags } : {}),
        ...(forum && features.includes("forum-tag-policy") ? { requireForumTag: requireTag } : {}),
        ...(forum && features.includes("forum-guidelines") ? { guidelines: guidelines.trim() || null } : {}),
        ...(parity
          ? channel.voice
            ? { stage: options.stage }
            : { textOnly: options.textOnly, noGifs: options.noGifs, readOnly: options.readOnly, posterRoleIds: options.readOnly ? options.posterRoleIds : [] }
          : {}),
      });
      onClose();
    } catch (err) {
      setError(errorText(err, uiText("organization.interface.couldn_t_save_the_channel_9afc549")));
    } finally {
      setBusy(false);
    }
  };
  const addTag = () => {
    const t = newTag.trim().slice(0, 20);
    if (t && !tags.some((x) => x.name.toLowerCase() === t.toLowerCase())) setTags([...tags, { id: undefined, name: t, restricted: false }]);
    setNewTag("");
  };
  // The reference's Overview | Permissions | Webhooks, each where it applies (community parity A1 and C).
  const tabList: ChannelDialogTab[] = ["overview", ...(parity ? (["permissions"] as const) : []), ...(webhooks ? (["webhooks"] as const) : [])];
  return (
    <Dialog title={uiText("organization.interface.edit_value0_ba63e4b", { value0: channel.name ?? uiText("messaging.interface.channel_69e3656") })} onClose={onClose} wide>
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
          <label htmlFor="ec-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input id="ec-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ec-topic">
            <Localized k="messaging.interface.topic_7e61847" />
          </label>
          <textarea id="ec-topic" className="textarea" rows={2} value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} />
        </div>
        {textChannel && features.includes("slowmode") && (
          <div className="field">
            <label htmlFor="ec-slow">
              <Localized k="organization.interface.slowmode_b529fb9" />
            </label>
            <select id="ec-slow" className="input" value={slowmode} onChange={(e) => setSlowmode(Number(e.target.value))}>
              {SLOWMODE_CHOICES.map((c) => (
                <option key={c.sec} value={c.sec}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="hint">
              <Localized k="organization.interface.how_long_each_member_waits_between_messages_people_who_manage_the_7594037" />
            </span>
          </div>
        )}
        {parity && (textChannel ? !forum && channel.kind !== "ANNOUNCEMENT" : true) && (
          <ChannelOptionsFields value={options} onChange={setOptions} voice={channel.voice} roles={roles} full slowmode={false} />
        )}
        {textChannel && features.includes("community-channels") && (
          <div className="setting">
            <span className="lines">
              <strong>
                <Localized k="organization.interface.forum_4da7bd4" />
              </strong>
              <small>
                <Localized k="organization.interface.posts_with_a_title_each_with_its_own_replies_messages_already_her_847b59d" />
              </small>
            </span>
            <Toggle checked={forum} onChange={setForum} label={uiText("organization.interface.forum_4da7bd4")} />
          </div>
        )}
        {forum && features.includes("forum-tags") && (
          <div className="field">
            <label htmlFor="ec-tag">
              <Localized k="organization.interface.tags_1331275" />
            </label>
            <div className="chips">
              {tags.map((t) => (
                <span key={t.name} className="chip">
                  {t.name}
                  {features.includes("forum-tag-policy") && (
                    <input
                      type="checkbox"
                      aria-label={`${l10n("workspace.forumTags.restricted")}: ${t.name}`}
                      checked={t.restricted}
                      onChange={(e) => setTags(tags.map((tag) => (tag === t ? { ...tag, restricted: e.target.checked } : tag)))}
                    />
                  )}
                  <button
                    type="button"
                    className="icon-btn icon-btn-xs"
                    aria-label={uiText("organization.interface.remove_tag_value0_35cbc9c", { value0: t.name })}
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {features.includes("forum-tag-policy") && (
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={requireTag} onChange={(e) => setRequireTag(e.target.checked)} />
                {l10n("workspace.forumTags.required")}
              </label>
            )}
            <div className="row" style={{ gap: 6 }}>
              <input
                id="ec-tag"
                className="input"
                value={newTag}
                maxLength={20}
                placeholder={uiText("organization.interface.add_a_tag_acfd447")}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={addTag} disabled={!newTag.trim() || tags.length >= 20}>
                <Plus size={15} /> {l10n("common.actions.add")}
              </button>
            </div>
          </div>
        )}
        {forum && features.includes("forum-guidelines") && (
          <div className="field">
            <label htmlFor="ec-guide">
              <Localized k="messaging.interface.post_guidelines_a4c1d0e" />
            </label>
            <textarea id="ec-guide" className="textarea" rows={4} value={guidelines} maxLength={2000} onChange={(e) => setGuidelines(e.target.value)} />
            <span className="hint">
              <Localized k="organization.interface.shown_at_the_top_of_the_forum_and_to_everyone_writing_a_post_edaa1b7" />
            </span>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? l10n("common.common_saving") : l10n("common.actions.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** Delete a channel for everyone: its name must be typed (android ChannelEditSheets, server confirmName). */
export function DeleteChannelDialog({ orgId, channel, onClose }: { orgId: string; channel: Conversation; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(errorText(e, uiText("organization.interface.couldn_t_delete_the_channel_37afddd")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("organization.interface.delete_value0_34f825d", { value0: name })} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>
          <Localized k="organization.interface.this_deletes_the_channel_for_everyone_with_the_server_s_copies_of_c0f5b63" />
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="dc-name">
            <Localized k="organization.interface.type_the_channel_s_name_to_confirm_d850863" />
          </label>
          <input id="dc-name" className="input" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoComplete="off" />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-danger" disabled={!ok || busy} onClick={() => void run()}>
            <Trash2 size={15} /> {busy ? uiText("organization.interface.deleting_43b5894") : uiText("organization.interface.delete_channel_2bbb809")}
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
  useLocaleRender();
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = async (to: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const { removed } = await saveLayout(engine, orgId, { channels: moveToCategory(channel.id, to, siblingsOf(to)) });
      if (removed > 0) engine.notice("info", uiText("organization.interface.moved_value0_lost_access_with_the_new_category_s_permissions_6c3f61f", { value0: countLabel(removed, "people") }));
      onClose();
    } catch (e) {
      setError(errorText(e, uiText("organization.interface.couldn_t_move_the_channel_59d766c")));
    } finally {
      setBusy(false);
    }
  };
  const places = [
    {
      id: null as string | null,
      get name() {
        return uiText("organization.interface.no_category_b91b9ca");
      },
    },
    ...categories.map((c) => ({ id: c.id as string | null, name: c.name })),
  ];
  return (
    <Dialog title={uiText("organization.interface.move_value0_1951c05", { value0: channel.name ?? uiText("messaging.interface.channel_69e3656") })} onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="organization.interface.the_channel_takes_the_new_category_s_permissions_so_who_can_see_i_270f55f" />
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
                {p.id === channel.categoryId && (
                  <small>
                    <Localized k="organization.interface.here_now_ccf67ff" />
                  </small>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
