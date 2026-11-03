import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { LEAVE_MANY_MAX, type LeaveManyResult, leaveWorkspaces } from "../../sync/workspaces";
import { OrgAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
type Step = "pick" | "confirm" | "done";
interface Community {
  id: string;
  name: string;
  photoRev: number | null;
  owned: boolean;
}
/** What the done step says: what was left, and what stayed and why. */
export function leaveSummary(result: LeaveManyResult, nameOf: (orgId: string) => string): string[] {
  const names = (ids: string[]) => ids.map(nameOf).join(", ");
  const lines: string[] = [];
  lines.push(
    result.left.length
      ? uiText("settings.interface.you_left_value0_value1_e8dc760", { value0: uiText("common.counts.communities", { count: result.left.length }), value1: names(result.left) })
      : uiText("settings.interface.you_didn_t_leave_any_community_25f2970"),
  );
  if (result.skippedOwned.length)
    lines.push(
      uiText("settings.interface.you_own_value0_so_value1_d52798d", {
        value0: names(result.skippedOwned),
        value1: result.skippedOwned.length === 1 ? uiText("settings.interface.it_stays_8b66b9f") : uiText("settings.interface.they_stay_7f218e0"),
      }),
    );
  if (result.notMember.length) lines.push(uiText("settings.interface.you_weren_t_in_value0_any_more_6d60a19", { value0: names(result.notMember) }));
  return lines;
}
/**
 * Leaving several communities at once (API 0.65.0, POST /v2/orgs/leave): tick them, check the list, then leave. Each
 * leave is the same as leaving one; communities you own can't be ticked, and the server skips them anyway.
 */
export function LeaveManyDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const orgs = useOrbit(
    (s) => s.orgs.map((o): Community => ({ id: o.id, name: o.name, photoRev: o.photoRev, owned: o.myRole === "OWNER" })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const sorted = useMemo(() => [...orgs].sort((a, b) => a.name.localeCompare(b.name)), [orgs]);
  // Names are kept from the start: a community left is no longer in the list when the summary is shown.
  const [names] = useState(() => new Map(orgs.map((o) => [o.id, o.name])));
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeaveManyResult | null>(null);
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else if (next.size < LEAVE_MANY_MAX) next.add(id);
      return next;
    });
  const chosen = sorted.filter((o) => picked.has(o.id));
  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await leaveWorkspaces(engine, [...picked]));
      setStep("done");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("settings.interface.couldn_t_leave_those_communities_try_again_7533f10"));
    } finally {
      setBusy(false);
    }
  };
  const footer =
    step === "pick" ? (
      <>
        <button className="btn btn-ghost" onClick={onClose}>
          {l10n("common.actions.cancel")}
        </button>
        <button className="btn btn-danger" disabled={picked.size === 0} onClick={() => setStep("confirm")}>
          {l10n("common.actions.next")}
        </button>
      </>
    ) : step === "confirm" ? (
      <>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setStep("pick")}>
          {l10n("common.actions.back")}
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={() => void leave()}>
          <LogOut size={15} aria-hidden="true" />{" "}
          {busy ? uiText("settings.interface.leaving_a4c0ef6") : uiText("settings.interface.leave_value0_0c663c6", { value0: uiText("common.counts.communities", { count: picked.size }) })}
        </button>
      </>
    ) : (
      <button className="btn btn-primary" onClick={onClose}>
        {l10n("common.actions.done")}
      </button>
    );
  return (
    <Dialog title={uiText("settings.interface.leave_several_communities_0e13793")} onClose={onClose} footer={footer}>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {step === "pick" && (
          <>
            <p className="muted" style={{ margin: 0 }}>
              <Localized k="settings.interface.tick_the_communities_to_leave_you_ll_leave_all_their_channels_2b4f931" />
            </p>
            <ul className="leave-many-list" aria-label={l10n("workspace.rail_communities")}>
              {sorted.map((o) => (
                <li key={o.id}>
                  <label className={`leave-many-row${o.owned ? " owned" : ""}`}>
                    <input type="checkbox" checked={picked.has(o.id)} disabled={o.owned} onChange={() => toggle(o.id)} />
                    <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={28} />
                    <span className="grow ellipsis">{o.name}</span>
                    {o.owned && (
                      <small className="faint">
                        <Localized k="settings.interface.you_own_this_2c67cb0" />
                      </small>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {step === "confirm" && (
          <>
            <p style={{ margin: 0 }}>
              <Localized k="settings.interface.leave_these_you_can_come_back_with_a_new_invitation_or_from_disco_24642db" slots={[uiText("common.counts.communities", { count: chosen.length })]} />
            </p>
            <ul className="leave-many-confirm">
              {chosen.map((o) => (
                <li key={o.id}>{o.name}</li>
              ))}
            </ul>
          </>
        )}
        {step === "done" && result && (
          <div role="status" style={{ display: "grid", gap: 6 }}>
            {leaveSummary(result, (id) => names.get(id) ?? uiText("settings.interface.a_community_d87ca85")).map((line) => (
              <p key={line} style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
