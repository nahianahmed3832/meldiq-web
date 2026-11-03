import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { AUDIT_FILTERS } from "../../sync/reports";
import { type AuditPage as Page, auditLog } from "../../sync/roles";
import { directory } from "../../sync/workspaces";
import { fullTime } from "../format";
import { useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";
/** The older servers' filters (workspaces with apps and branches). */
const LEGACY_FILTERS: {
  action: string | null;
  label: string;
}[] = [
  {
    action: null,
    get label() {
      return uiText("workspace.interface.everything_75304cf");
    },
  },
  {
    action: "role",
    get label() {
      return uiText("organization.roles");
    },
  },
  {
    action: "member",
    get label() {
      return uiText("workspace.members");
    },
  },
  {
    action: "channel",
    get label() {
      return uiText("organization.channels");
    },
  },
  {
    action: "invite",
    get label() {
      return uiText("organization.invitations");
    },
  },
  {
    action: "integration",
    get label() {
      return uiText("workspace.interface.apps_89dd748");
    },
  },
  {
    action: "org",
    get label() {
      return uiText("workspace.interface.workspace_87bb59b");
    },
  },
];
/**
 * Audit log (server docs/WORKSPACE_ROLES.md, batch B4 filters): every administrative change, newest first, for those
 * allowed; filtered by kind of change (Members, Channels, Categories, Roles, Invites, Community, Reports) and by person.
 */
export function AuditPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const community = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const people = useLoad(() => (community && detail.permissions.canViewDirectory ? directory(engine, detail.org.id) : Promise.resolve([])), [engine, detail.org.id, community]);
  const first = useLoad(() => auditLog(engine, detail.org.id, null, action || undefined, actor || undefined), [engine, detail.org.id, action, actor]);
  const all = [first.data, ...pages].filter((p): p is Page => !!p);
  const next = all.at(-1)?.nextBefore ?? null;
  const filters = community ? AUDIT_FILTERS : LEGACY_FILTERS;
  return (
    <div className="ws-page">
      <Card
        title={uiText("workspace.interface.audit_log_e4d36f9")}
        sub={uiText("workspace.interface.administrative_changes_in_this_value0_message_content_is_never_he_8271729", {
          value0: community ? uiText("workspace.interface.community_f354ee9") : uiText("workspace.interface.workspace_a279fe9"),
        })}
      >
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="chips" role="group" aria-label={uiText("workspace.interface.kind_of_change_b92d273")}>
            {filters.map((f) => (
              <button
                key={f.label}
                className="chip"
                aria-pressed={(f.action ?? "") === action}
                onClick={() => {
                  setPages([]);
                  setAction(f.action ?? "");
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {community && (people.data?.length ?? 0) > 0 && (
            <select
              className="input input-sm"
              value={actor}
              aria-label={uiText("workspace.interface.made_by_25a2391")}
              onChange={(e) => {
                setPages([]);
                setActor(e.target.value);
              }}
            >
              <option value="">
                <Localized k="organization.interface.anyone_8d486bb" />
              </option>
              {people.data!.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
        <ErrorLine text={first.error} />
        <ul className="ws-list">
          {all
            .flatMap((p) => p.entries)
            .map((e) => (
              <li key={e.id} className="ws-row">
                <span className="lines grow">
                  <span>
                    <strong>{e.actorName ?? l10n("messaging.react_someone")}</strong> · {e.action.replace(/[._]/g, " ")}
                  </span>
                  <small>
                    {fullTime(e.at)}
                    {e.detail ? uiText("calls.interface.value0_9402340", { value0: e.detail }) : ""}
                  </small>
                </span>
              </li>
            ))}
          {first.data && all[0].entries.length === 0 && (
            <li className="faint">
              <Localized k="workspace.interface.nothing_recorded_32b4c78" slots={[action || actor ? uiText("workspace.interface.that_matches_54484b0") : uiText("workspace.interface.yet_cfd96dd")]} />
            </li>
          )}
        </ul>
        {next && (
          <button className="btn btn-secondary btn-sm" onClick={() => void auditLog(engine, detail.org.id, next, action || undefined, actor || undefined).then((p) => setPages((x) => [...x, p]))}>
            <Localized k="workspace.interface.older_03281c8" />
          </button>
        )}
      </Card>
    </div>
  );
}
