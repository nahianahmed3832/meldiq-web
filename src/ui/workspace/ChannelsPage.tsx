import { Archive, ArchiveRestore, Hash, Lock, Megaphone, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Conversation } from "../../api/schemas";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { navigate } from "../../app/router";
import { type ChannelKind, type ChannelScope, createChannel, updateConversation, workspaceChannels } from "../../sync/workspaces";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

export const KIND_TEXT: Record<ChannelKind, { label: string; help: string }> = {
  PUBLIC: { label: "Public", help: "Anyone it's for can find and join it." },
  PRIVATE: { label: "Private", help: "Only the people added to it." },
  ANNOUNCEMENT: { label: "Announcement", help: "Everyone it's for is in it; only managers post." },
};

export function KindIcon({ kind, size = 16 }: { kind: string | null; size?: number }) {
  return kind === "PRIVATE" ? <Lock size={size} /> : kind === "ANNOUNCEMENT" ? <Megaphone size={size} /> : <Hash size={size} />;
}

/** Channels of the workspace (docs/WORKSPACE_ADMINISTRATION.md §3, §6): create, access mode, archive and restore. */
export function ChannelsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [version, setVersion] = useState(0);
  const manager = detail.permissions.canCreateChannels || detail.permissions.canManageOrg;
  const list = useLoad(() => workspaceChannels(engine, orgId, manager), [engine, orgId, manager, version, detail]);
  const reload = () => setVersion((v) => v + 1);
  const live = (list.data ?? []).filter((c) => !c.archived);
  const archived = (list.data ?? []).filter((c) => c.archived && c.canManage);
  return (
    <div className="ws-page">
      {detail.permissions.canCreateChannels && <NewChannel detail={detail} onCreated={reload} />}
      <Card title="Channels" sub="Channels you can see in this workspace.">
        <ErrorLine text={list.error} />
        <ul className="ws-list" aria-label="Channels" aria-busy={list.loading}>
          {live.map((c) => (
            <ChannelRow key={c.id} c={c} onChanged={reload} />
          ))}
          {list.data && live.length === 0 && <li className="faint">No channels yet.</li>}
        </ul>
      </Card>
      {archived.length > 0 && (
        <Card title="Archived channels" sub="Read-only for everyone. Restoring brings a channel back as it was.">
          <ul className="ws-list" aria-label="Archived channels">
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
  const engine = useEngine();
  const act = useAction();
  const kind = (c.kind ?? "PUBLIC") as ChannelKind;
  return (
    <li className="ws-row">
      <span className="faint">
        <KindIcon kind={c.kind} />
      </span>
      <span className="lines grow">
        {c.joined && !c.archived ? (
          <a className="ellipsis" href={`#/home/c/${encodeURIComponent(c.id)}`} onClick={() => navigate({ section: "home", conversationId: c.id })}>
            {c.name}
          </a>
        ) : (
          <span className="ellipsis">{c.name}</span>
        )}
        <small className="ellipsis">
          {c.scopeName ?? "Whole workspace"} · {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
          {c.topic ? ` · ${c.topic}` : ""}
        </small>
      </span>
      {c.canManageAccess && !c.archived ? (
        <select
          className="input input-sm"
          aria-label={`Access for ${c.name}`}
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
        <span className="status-badge">{KIND_TEXT[kind]?.label ?? "Public"}</span>
      )}
      {c.canManage &&
        (c.archived ? (
          <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => updateConversation(engine, c.id, { archived: false }).then(onChanged))}>
            <ArchiveRestore size={14} /> Restore
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            disabled={act.busy}
            onClick={() => void act.act(() => updateConversation(engine, c.id, { archived: true }).then(onChanged))}
            aria-label={`Archive ${c.name}`}
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
  const engine = useEngine();
  const isAdmin = detail.permissions.canManageOrg;
  const scopes = [
    ...(isAdmin ? [{ value: "ORG:", label: "The whole workspace" }] : []),
    ...detail.branches.filter((b) => b.canManage).map((b) => ({ value: `BRANCH:${b.id}`, label: `Branch: ${b.name}` })),
    ...detail.teams.filter((t) => t.canManage).map((t) => ({ value: `TEAM:${t.id}`, label: `Team: ${t.name}` })),
  ];
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [scope, setScope] = useState(scopes[0]?.value ?? "ORG:");
  const [kind, setKind] = useState<ChannelKind>("PUBLIC");
  const act = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const [s, id] = scope.split(":");
    void act.act(async () => {
      const ch = await createChannel(engine, detail.org.id, { name, topic: topic || null, scope: s as ChannelScope, scopeId: id || null, kind });
      setName("");
      setTopic("");
      onCreated();
      navigate({ section: "home", conversationId: ch.id });
    });
  };

  return (
    <Card title="New channel">
      <form onSubmit={submit} className="ws-form">
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. design-reviews" />
        </label>
        <label className="field">
          <span>For</span>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Access</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ChannelKind)}>
            {(Object.keys(KIND_TEXT) as ChannelKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_TEXT[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field ws-wide">
          <span>Topic (optional)</span>
          <input className="input" value={topic} maxLength={250} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <p className="faint ws-wide" style={{ margin: 0, fontSize: 13 }}>
          {KIND_TEXT[kind].help}
        </p>
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={!name.trim() || act.busy || scopes.length === 0}>
            <Plus size={14} /> {act.busy ? "Creating…" : "Create channel"}
          </button>
        </div>
      </form>
      <ErrorLine text={act.error} />
    </Card>
  );
}
