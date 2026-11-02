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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the done step says: what was left, and what stayed and why. */
export function leaveSummary(result: LeaveManyResult, nameOf: (orgId: string) => string): string[] {
  const names = (ids: string[]) => ids.map(nameOf).join(", ");
  const lines: string[] = [];
  lines.push(result.left.length ? `You left ${plural(result.left.length, "community", "communities")}: ${names(result.left)}.` : "You didn't leave any community.");
  if (result.skippedOwned.length) lines.push(`You own ${names(result.skippedOwned)}, so ${result.skippedOwned.length === 1 ? "it stays" : "they stay"}.`);
  if (result.notMember.length) lines.push(`You weren't in ${names(result.notMember)} any more.`);
  return lines;
}

/**
 * Leaving several communities at once (API 0.65.0, POST /v2/orgs/leave): tick them, check the list, then leave. Each
 * leave is the same as leaving one; communities you own can't be ticked, and the server skips them anyway.
 */
export function LeaveManyDialog({ onClose }: { onClose: () => void }) {
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
      setError(e instanceof ApiError ? e.message : "Couldn't leave those communities. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const footer =
    step === "pick" ? (
      <>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-danger" disabled={picked.size === 0} onClick={() => setStep("confirm")}>
          Next
        </button>
      </>
    ) : step === "confirm" ? (
      <>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setStep("pick")}>
          Back
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={() => void leave()}>
          <LogOut size={15} aria-hidden="true" /> {busy ? "Leaving…" : `Leave ${plural(picked.size, "community", "communities")}`}
        </button>
      </>
    ) : (
      <button className="btn btn-primary" onClick={onClose}>
        Done
      </button>
    );

  return (
    <Dialog title="Leave several communities" onClose={onClose} footer={footer}>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {step === "pick" && (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Tick the communities to leave. You'll leave all their channels.
            </p>
            <ul className="leave-many-list" aria-label="Your communities">
              {sorted.map((o) => (
                <li key={o.id}>
                  <label className={`leave-many-row${o.owned ? " owned" : ""}`}>
                    <input type="checkbox" checked={picked.has(o.id)} disabled={o.owned} onChange={() => toggle(o.id)} />
                    <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={28} />
                    <span className="grow ellipsis">{o.name}</span>
                    {o.owned && <small className="faint">You own this</small>}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {step === "confirm" && (
          <>
            <p style={{ margin: 0 }}>Leave these {plural(chosen.length, "community", "communities")}? You can come back with a new invitation, or from Discover if they're open.</p>
            <ul className="leave-many-confirm">
              {chosen.map((o) => (
                <li key={o.id}>{o.name}</li>
              ))}
            </ul>
          </>
        )}
        {step === "done" && result && (
          <div role="status" style={{ display: "grid", gap: 6 }}>
            {leaveSummary(result, (id) => names.get(id) ?? "a community").map((line) => (
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
