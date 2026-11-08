import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Archive, ArchiveRestore, Hash, Lock, Megaphone, Plus, Settings } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Conversation } from "../../api/schemas";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { joinChannel } from "../../sync/account";
import { type ChannelKind, type ChannelScope, createChannel, updateConversation, workspaceChannels } from "../../sync/workspaces";
import { ChannelOrder } from "./ChannelOrder";
import { ChannelGlyph } from "../community/ChannelDialogs";
import { useAction, useLoad } from "./useLoad";
import { CreateChannelDialog } from "../community/CreateChannelDialog";
import { EditChannelDialog } from "../community/ChannelDialogs";
import { categoriesOf } from "../community/panelData";
import { permissionsOf } from "../community/useCommunityPermissions";
import { PermissionsDialog } from "../community/PermissionsDialog";
import { confirmAction } from "../components/ConfirmationDialog";
import { Card, ErrorLine } from "../components/SettingsCard";
export const KIND_TEXT: Record<
  ChannelKind,
  {
    label: string;
    help: string;
  }
> = {
  PUBLIC: {
    get label() {
      return uiText("workspace.interface.public_591935b");
    },
    get help() {
      return uiText("organization.interface.anyone_it_s_for_can_find_and_join_it_04362ce");
    },
  },
  PRIVATE: {
    get label() {
      return uiText("workspace.interface.private_c63eb67");
    },
    get help() {
      return uiText("organization.interface.only_the_people_added_to_it_92e585b");
    },
  },
  ANNOUNCEMENT: {
    get label() {
      return uiText("organization.interface.announcement_028cd1c");
    },
    get help() {
      return uiText("organization.interface.everyone_it_s_for_is_in_it_only_managers_post_157a682");
    },
  },
};
export function KindIcon({ kind, size = 16 }: { kind: string | null; size?: number }) {
  useLocaleRender();
  return kind === "PRIVATE" ? <Lock size={size} /> : kind === "ANNOUNCEMENT" ? <Megaphone size={size} /> : <Hash size={size} />;
}
/** Channels of the workspace (docs/WORKSPACE_ADMINISTRATION.md §3, §6): create, access mode, archive and restore. */
export function ChannelsPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const orgId = detail.org.id;
  const [version, setVersion] = useState(0);
  const manager = detail.permissions.canCreateChannels || detail.permissions.canManageOrg;
  const community = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const arrange = detail.permissions.isOwner || detail.permissions.canManageChannels;
  const [creating, setCreating] = useState(false);
  // Scope-based workspaces retain their branch/team channel workflow on older deployments.
  const scoped = detail.branches.length > 0 || detail.teams.length > 0;
  const sharedEditor = community && !scoped;
  const list = useLoad(() => workspaceChannels(engine, orgId, manager), [engine, orgId, manager, version, detail]);
  const reload = () => setVersion((v) => v + 1);
  const live = (list.data ?? []).filter((c) => !c.archived);
  const archived = (list.data ?? []).filter((c) => c.archived && c.canManage);
  return (
    <div className="ws-page">
      {sharedEditor && arrange && list.data && <ChannelOrder orgId={orgId} channels={live} categories={categories} canCreate={permissionsOf(detail).canCreateTop} reload={reload} />}
      {detail.permissions.canCreateChannels && !sharedEditor && <NewChannel detail={detail} onCreated={reload} />}
      <Card
        title={l10n("organization.channels")}
        sub={uiText("organization.interface.channels_you_can_see_in_this_community_9a58d01")}
        actions={
          detail.permissions.canCreateChannels && sharedEditor ? (
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              <Plus size={16} />
              {uiText("organization.interface.create_channel_f0f8831")}
            </button>
          ) : undefined
        }
      >
        <ErrorLine text={list.error} />
        <ul className="ws-list" aria-label={l10n("organization.channels")} aria-busy={list.loading}>
          {live.map((c) => (
            <ChannelRow key={c.id} c={c} onChanged={reload} />
          ))}
          {list.data && live.length === 0 && (
            <li className="faint">
              <Localized k="organization.interface.no_channels_yet_abf77d1" />
            </li>
          )}
        </ul>
      </Card>
      {creating && (
        <CreateChannelDialog
          orgId={orgId}
          categories={categories}
          categoryId={null}
          canCreateTop={permissionsOf(detail).canCreateTop}
          onClose={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {archived.length > 0 && (
        <Card title={uiText("organization.interface.archived_channels_5da01c5")} sub={uiText("organization.interface.read_only_for_everyone_restoring_brings_a_channel_back_as_it_was_c2c1941")}>
          <ul className="ws-list" aria-label={uiText("organization.interface.archived_channels_5da01c5")}>
            {archived.map((c) => (
              <ChannelRow key={c.id} c={c} onChanged={reload} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
function ChannelRow({ c, onChanged }: { c: Conversation; onChanged: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const act = useAction();
  const isRules = useOrbit((s) => !!c.orgId && s.orgs.find((o) => o.id === c.orgId)?.rulesChannel?.channelId === c.id);
  const kind = (c.kind ?? "PUBLIC") as ChannelKind;
  const community = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const [editing, setEditing] = useState(false);
  const [access, setAccess] = useState(false);
  return (
    <li className="ws-row">
      <span className="faint">
        <ChannelGlyph kind={c.kind} voice={c.voice} format={c.format} rules={isRules} />
      </span>
      <span className="lines grow">
        {c.joined && !c.archived ? (
          <a className="ellipsis" href={`/home/c/${encodeURIComponent(c.id)}`} onClick={() => navigate({ section: "home", conversationId: c.id })}>
            {c.name}
          </a>
        ) : !c.archived ? (
          // A channel you haven't joined joins on a click of its name too, then opens (android round 7).
          <button
            className="link-btn ellipsis"
            disabled={act.busy}
            onClick={() =>
              void act.act(async () => {
                await joinChannel(engine, c.id);
                navigate({ section: "home", conversationId: c.id });
              })
            }
            title={uiText("organization.interface.join_and_open_0d62a08")}
          >
            {c.name}
          </button>
        ) : (
          <span className="ellipsis">{c.name}</span>
        )}
        <small className="ellipsis">
          {c.scopeName ?? uiText("organization.interface.whole_community_ff83663")} · {formatUiNumber(c.memberCount)}{" "}
          {c.memberCount === 1 ? uiText("organization.interface.member_e31ab64") : uiText("organization.interface.members_17373ca")}
          {c.topic ? uiText("calls.interface.value0_9402340", { value0: c.topic }) : ""}
        </small>
      </span>
      {isRules ? (
        <span className="status-badge">
          <Localized k="organization.rules_title" />
        </span>
      ) : c.canManageAccess && !c.archived && !community ? (
        <select
          className="input input-sm"
          aria-label={uiText("organization.interface.access_for_value0_9e236a9", { value0: c.name })}
          value={kind}
          disabled={act.busy}
          onChange={(e) => void act.act(() => updateConversation(engine, c.id, { kind: e.target.value as ChannelKind }).then(onChanged))}
        >
          {(Object.keys(KIND_TEXT) as ChannelKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_TEXT[k].label}
            </option>
          ))}
        </select>
      ) : (
        <span className="status-badge">{KIND_TEXT[kind]?.label ?? uiText("workspace.interface.public_591935b")}</span>
      )}
      {c.canManage && community && !c.archived && (
        <button className="btn btn-secondary btn-sm" aria-label={uiText("organization.interface.edit_value0_ba63e4b", { value0: c.name ?? "" })} onClick={() => setEditing(true)}>
          <Settings size={15} />
          {uiText("common.actions.edit")}
        </button>
      )}
      {editing && (
        <EditChannelDialog
          channel={c}
          onClose={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      {community && c.canManageAccess && !c.canManage && !c.archived && c.orgId && (
        <button className="btn btn-secondary btn-sm" onClick={() => setAccess(true)}>
          {uiText("organization.interface.manage_channel_access_712a23d")}
        </button>
      )}
      {access && c.orgId && (
        <PermissionsDialog
          orgId={c.orgId}
          target={{ type: "channel", id: c.id }}
          title={c.name ?? ""}
          onClose={() => {
            setAccess(false);
            onChanged();
          }}
        />
      )}
      {c.canManage &&
        (c.archived ? (
          <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => updateConversation(engine, c.id, { archived: false }).then(onChanged))}>
            <Localized k="organization.interface.restore_e004112" slots={[<ArchiveRestore size={14} />]} />
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            disabled={act.busy}
            onClick={async () => {
              if (await confirmAction(uiText("organization.interface.archive_value0_70e6dbe", { value0: c.name })))
                void act.act(() => updateConversation(engine, c.id, { archived: true }).then(onChanged));
            }}
            aria-label={uiText("organization.interface.archive_value0_70e6dbe", { value0: c.name })}
          >
            <Archive size={14} />
          </button>
        ))}
      {act.error && (
        <div className="ws-row-error" role="alert">
          {act.error}
        </div>
      )}
    </li>
  );
}
function NewChannel({ detail, onCreated }: { detail: OrgAdminDetail; onCreated: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const isAdmin = detail.permissions.canManageOrg;
  const scopes = [
    ...(isAdmin
      ? [
          {
            value: "ORG:",
            get label() {
              return uiText("organization.interface.the_whole_community_838f2d7");
            },
          },
        ]
      : []),
    ...detail.branches.filter((b) => b.canManage).map((b) => ({ value: `BRANCH:${b.id}`, label: uiText("organization.interface.branch_value0_de7df4c", { value0: b.name }) })),
    ...detail.teams.filter((t) => t.canManage).map((t) => ({ value: `TEAM:${t.id}`, label: uiText("organization.interface.team_value0_0c69424", { value0: t.name }) })),
  ];
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [scope, setScope] = useState(scopes[0]?.value ?? "ORG:");
  const [kind, setKind] = useState<ChannelKind>("PUBLIC");
  const [voice, setVoice] = useState(false);
  const voiceOffered = useOrbit((s) => s.server?.features.includes("voice-rooms") ?? false);
  const act = useAction();
  const kinds = (Object.keys(KIND_TEXT) as ChannelKind[]).filter((k) => !(voice && k === "ANNOUNCEMENT"));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const [s, id] = scope.split(":");
    void act.act(async () => {
      const ch = await createChannel(engine, detail.org.id, { name, topic: topic || null, scope: s as ChannelScope, scopeId: id || null, kind, voice });
      setName("");
      setTopic("");
      setVoice(false);
      onCreated();
      navigate({ section: "home", conversationId: ch.id });
    });
  };
  return (
    <Card title={uiText("organization.interface.new_channel_ce76c34")}>
      <form onSubmit={submit} className="ws-form">
        <label className="field">
          <span>
            <Localized k="messaging.interface.name_dcd1d52" />
          </span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={uiText("organization.interface.e_g_design_reviews_d42499f")} />
        </label>
        <label className="field">
          <span>
            <Localized k="organization.interface.for_ca15ebc" />
          </span>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            <Localized k="organization.interface.access_ec5ba0a" />
          </span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ChannelKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_TEXT[k].label}
              </option>
            ))}
          </select>
        </label>
        {voiceOffered && (
          <label className="row ws-wide" style={{ gap: 10, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => {
                setVoice(e.target.checked);
                if (e.target.checked && kind === "ANNOUNCEMENT") setKind("PUBLIC");
              }}
            />
            <span>
              <Localized k="organization.interface.voice_room_people_drop_into_its_call_from_home_without_anyone_bei_920d94d" />
            </span>
          </label>
        )}
        <label className="field ws-wide">
          <span>
            <Localized k="organization.interface.topic_optional_5435146" />
          </span>
          <input className="input" value={topic} maxLength={250} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <p className="faint ws-wide" style={{ margin: 0, fontSize: 13 }}>
          {KIND_TEXT[kind].help}
        </p>
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={!name.trim() || act.busy || scopes.length === 0}>
            <Plus size={14} /> {act.busy ? l10n("auth.signup_busy") : voice ? uiText("organization.interface.create_voice_room_f428611") : uiText("organization.interface.create_channel_f0f8831")}
          </button>
        </div>
      </form>
      <ErrorLine text={act.error} />
    </Card>
  );
}
