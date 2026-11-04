import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Copy, Link2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { communitySettings, linkProblem, saveCommunitySettings, SETTINGS_LIMITS, slugLockedReason, slugProblem } from "../../sync/communitySettings";
import { inviteLink } from "../../sync/inviteCodes";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
interface ProfileExtrasProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}
/**
 * Profile's custom invite link and links (community parity A3, feature community-settings): a link of the community's
 * own once it has 5 members, and up to five links shown on its profile. Only for people who edit the community.
 */
export function ProfileExtrasCards({ detail, onChanged }: ProfileExtrasProps) {
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [text, setText] = useState(slug ?? "");
  const save = useAction();
  useEffect(() => setText(slug ?? ""), [slug]);
  const problem = slugProblem(text);
  const clean = text.trim().toLowerCase() || null;
  return (
    <Card title={uiText("files.interface.custom_invite_link_6c09fd6")} sub={locked ?? uiText("files.interface.a_link_of_the_community_s_own_that_never_expires_anyone_who_has_i_a5adc41")}>
      <ErrorLine text={save.error} />
      <div className="row" style={{ gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span className="faint mono">{inviteLink("")}</span>
        <input
          className="input mono"
          style={{ flex: "1 1 160px" }}
          value={text}
          maxLength={SETTINGS_LIMITS.slugMax}
          disabled={!!locked && !slug}
          placeholder={"our-community"}
          aria-label={uiText("files.interface.custom_invite_link_6c09fd6")}
          aria-invalid={!!problem}
          onChange={(e) => setText(e.target.value)}
        />
        {slug && (
          <button
            className="icon-btn"
            aria-label={uiText("files.interface.copy_the_custom_invite_link_27738b5")}
            onClick={() => void navigator.clipboard?.writeText(inviteLink(slug)).then(() => engine.notice("info", uiText("messaging.interface.link_copied_71af38a")))}
          >
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
          {save.busy ? l10n("common.common_saving") : uiText("files.interface.save_link_72145d7")}
        </button>
        {slug && (
          <button className="btn btn-ghost btn-sm" disabled={save.busy} onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { inviteSlug: null }).then(onChanged))}>
            {l10n("common.actions.remove")}
          </button>
        )}
      </div>
    </Card>
  );
}
type Link = {
  label: string;
  url: string;
};
function LinksCard({ orgId, links, onChanged }: { orgId: string; links: Link[]; onChanged: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [rows, setRows] = useState<Link[]>(links);
  const save = useAction();
  useEffect(() => setRows(links), [links]);
  const problems = rows.map(linkProblem);
  const dirty = JSON.stringify(rows) !== JSON.stringify(links);
  const set = (i: number, change: Partial<Link>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));
  return (
    <Card
      title={uiText("messaging.interface.links_9024c19")}
      sub={uiText("files.interface.up_to_value0_links_on_the_community_s_profile_a_website_socials_a_250f43b", { value0: SETTINGS_LIMITS.links })}
    >
      <ErrorLine text={save.error} />
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Link2 size={15} className="faint" aria-hidden="true" />
          <input
            className="input"
            style={{ flex: "1 1 120px" }}
            value={r.label}
            maxLength={SETTINGS_LIMITS.linkLabel}
            placeholder={uiText("files.interface.website_b5a229a")}
            aria-label={uiText("settings.interface.link_value0_name_0bf81ea", { value0: i + 1 })}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            className="input"
            style={{ flex: "2 1 200px" }}
            value={r.url}
            maxLength={SETTINGS_LIMITS.linkUrl}
            placeholder="https://"
            aria-label={uiText("settings.interface.link_value0_address_d32166e", { value0: i + 1 })}
            aria-invalid={!!problems[i]}
            onChange={(e) => set(i, { url: e.target.value })}
          />
          <button className="icon-btn" aria-label={uiText("settings.interface.remove_link_value0_b78eb82", { value0: i + 1 })} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <X size={15} />
          </button>
          {problems[i] && (r.label || r.url) && <small className="field-error">{problems[i]}</small>}
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        {rows.length < SETTINGS_LIMITS.links && (
          <button className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, { label: "", url: "" }])}>
            <Localized k="files.interface.add_link_ad83ea9" slots={[<Plus size={14} />]} />
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || save.busy || problems.some(Boolean)}
          onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { links: rows.map((r) => ({ label: r.label.trim(), url: r.url.trim() })) }).then(onChanged))}
        >
          {save.busy ? l10n("common.common_saving") : uiText("files.interface.save_links_6de66bf")}
        </button>
      </div>
    </Card>
  );
}
