import { Copy, Link2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { communitySettings, linkProblem, saveCommunitySettings, SETTINGS_LIMITS, slugLockedReason, slugProblem } from "../../sync/communitySettings";
import { inviteLink } from "../../sync/inviteCodes";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

interface ProfileExtrasProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}

/**
 * Profile's custom invite link and links (community parity A3, feature community-settings): a link of the community's
 * own once it has 5 members, and up to five links shown on its profile. Only for people who edit the community.
 */
export function ProfileExtrasCards({ detail, onChanged }: ProfileExtrasProps) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const settings = useLoad(() => communitySettings(engine, orgId), [engine, orgId, detail.org]);
  if (!settings.data) return settings.error ? <ErrorLine text={settings.error} /> : null;
  const s = settings.data;
  return (
    <>
      <InviteSlugCard orgId={orgId} slug={s.inviteSlug} locked={slugLockedReason(s.memberCount, s.inviteSlugMinMembers)} onChanged={onChanged} />
      <LinksCard orgId={orgId} links={s.links} onChanged={onChanged} />
    </>
  );
}

function InviteSlugCard({ orgId, slug, locked, onChanged }: { orgId: string; slug: string | null; locked: string | null; onChanged: () => void }) {
  const engine = useEngine();
  const [text, setText] = useState(slug ?? "");
  const save = useAction();
  useEffect(() => setText(slug ?? ""), [slug]);
  const problem = slugProblem(text);
  const clean = text.trim().toLowerCase() || null;
  return (
    <Card title="Custom invite link" sub={locked ?? "A link of the community's own that never expires. Anyone who has it can join."}>
      <ErrorLine text={save.error} />
      <div className="row" style={{ gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span className="faint mono">{inviteLink("")}</span>
        <input
          className="input mono"
          style={{ flex: "1 1 160px" }}
          value={text}
          maxLength={SETTINGS_LIMITS.slugMax}
          disabled={!!locked && !slug}
          placeholder="our-community"
          aria-label="Custom invite link"
          aria-invalid={!!problem}
          onChange={(e) => setText(e.target.value)}
        />
        {slug && (
          <button className="icon-btn" aria-label="Copy the custom invite link" onClick={() => void navigator.clipboard?.writeText(inviteLink(slug)).then(() => engine.notice("info", "Link copied."))}>
            <Copy size={15} />
          </button>
        )}
      </div>
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={save.busy || !!problem || clean === slug || (!!locked && clean !== null)}
          onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { inviteSlug: clean }).then(onChanged))}
        >
          {save.busy ? "Saving…" : "Save link"}
        </button>
        {slug && (
          <button className="btn btn-ghost btn-sm" disabled={save.busy} onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { inviteSlug: null }).then(onChanged))}>
            Remove
          </button>
        )}
      </div>
    </Card>
  );
}

type Link = { label: string; url: string };

function LinksCard({ orgId, links, onChanged }: { orgId: string; links: Link[]; onChanged: () => void }) {
  const engine = useEngine();
  const [rows, setRows] = useState<Link[]>(links);
  const save = useAction();
  useEffect(() => setRows(links), [links]);
  const problems = rows.map(linkProblem);
  const dirty = JSON.stringify(rows) !== JSON.stringify(links);
  const set = (i: number, change: Partial<Link>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));
  return (
    <Card title="Links" sub={`Up to ${SETTINGS_LIMITS.links} links on the community's profile: a website, socials, a store.`}>
      <ErrorLine text={save.error} />
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Link2 size={15} className="faint" aria-hidden="true" />
          <input
            className="input"
            style={{ flex: "1 1 120px" }}
            value={r.label}
            maxLength={SETTINGS_LIMITS.linkLabel}
            placeholder="Website"
            aria-label={`Link ${i + 1} name`}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            className="input"
            style={{ flex: "2 1 200px" }}
            value={r.url}
            maxLength={SETTINGS_LIMITS.linkUrl}
            placeholder="https://"
            aria-label={`Link ${i + 1} address`}
            aria-invalid={!!problems[i]}
            onChange={(e) => set(i, { url: e.target.value })}
          />
          <button className="icon-btn" aria-label={`Remove link ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <X size={15} />
          </button>
          {problems[i] && (r.label || r.url) && <small className="field-error">{problems[i]}</small>}
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        {rows.length < SETTINGS_LIMITS.links && (
          <button className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, { label: "", url: "" }])}>
            <Plus size={14} /> Add link
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || save.busy || problems.some(Boolean)}
          onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { links: rows.map((r) => ({ label: r.label.trim(), url: r.url.trim() })) }).then(onChanged))}
        >
          {save.busy ? "Saving…" : "Save links"}
        </button>
      </div>
    </Card>
  );
}
