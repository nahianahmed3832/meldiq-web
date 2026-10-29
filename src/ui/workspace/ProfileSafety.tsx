import { Lock, LockOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SafetySettings } from "../../api/schemas";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { ACCOUNT_AGE_CHOICES, type AccountAgeGate, lockCommunity, PARITY_FEATURES, PROFILE_LOCK_CHOICES, VERIFICATION_LEVELS, type VerificationLevel } from "../../sync/communityParity";
import { type SafetyChange, safetySettings, setSafetySettings } from "../../sync/communitySafety";
import { running } from "../../sync/reports";
import { Toggle } from "../components/Toggle";
import { untilWhen } from "../format";
import { SecurityPage } from "./ModerationPages";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

interface ProfileSafetyProps {
  detail: OrgAdminDetail;
  /** Opened from an old Security actions link: scroll here. */
  focused: boolean;
}

/**
 * Profile's safety section (the reference keeps raid protection and verification on its server profile): the lock and
 * raid protection, the verification level and the new-account gate (community-safety), then Security actions.
 */
export function ProfileSafety({ detail, focused }: ProfileSafetyProps) {
  const features = useOrbit((s) => s.server?.features ?? []);
  const ref = useRef<HTMLElement>(null);
  const { permissions: can } = detail;
  const moderator = can.canManageOrg || can.canBan;
  const security = features.includes("security-actions") && moderator;
  const safety = features.includes(PARITY_FEATURES.safety) && moderator;
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" });
  }, [focused]);
  if (!security && !safety) return null;
  return (
    <section ref={ref} className="ws-page" aria-labelledby="ws-safety-title">
      <h2 id="ws-safety-title" className="ws-subhead">
        Safety
      </h2>
      {safety && <SafetyCards detail={detail} />}
      {security && <SecurityPage detail={detail} />}
    </section>
  );
}

function SafetyCards({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const loaded = useLoad(() => (detail.org.safety ? Promise.resolve(detail.org.safety) : safetySettings(engine, orgId)), [engine, orgId, detail.org.safety]);
  const [s, setS] = useState<SafetySettings | null>(null);
  const save = useAction();
  const current = s ?? loaded.data;
  const editable = detail.permissions.canManageOrg;
  const change = (c: SafetyChange) => void save.act(async () => setS(await setSafetySettings(engine, orgId, c)));
  if (!current) return loaded.error ? <ErrorLine text={loaded.error} /> : <div className="skeleton" style={{ height: 120 }} />;
  return (
    <>
      <RaidCard orgId={orgId} settings={current} editable={editable} onRaid={(on) => change({ raidProtection: on })} onLocked={(lockedUntil) => setS({ ...current, lockedUntil })} />
      {editable && (
        <Card title="Who can post" sub="Moderators, people with a role and bots skip these checks.">
          <ErrorLine text={save.error} />
          <label className="field">
            <span>Verification level</span>
            <select className="input" value={current.verificationLevel} disabled={save.busy} onChange={(e) => change({ verificationLevel: e.target.value as VerificationLevel })}>
              {VERIFICATION_LEVELS.map((v) => (
                <option key={v.level} value={v.level}>
                  {v.label}
                </option>
              ))}
            </select>
            <small className="faint">{VERIFICATION_LEVELS.find((v) => v.level === current.verificationLevel)?.hint}</small>
          </label>
          <label className="field">
            <span>New accounts</span>
            <select className="input" value={current.newAccountGate} disabled={save.busy} onChange={(e) => change({ newAccountGate: e.target.value as AccountAgeGate })}>
              {ACCOUNT_AGE_CHOICES.map((c) => (
                <option key={c.gate} value={c.gate}>
                  {c.label}
                </option>
              ))}
            </select>
            <small className="faint">Accounts this new can't join. Moderators and Meldiq staff are never held back.</small>
          </label>
        </Card>
      )}
    </>
  );
}

interface RaidCardProps {
  orgId: string;
  settings: SafetySettings;
  editable: boolean;
  onRaid: (on: boolean) => void;
  onLocked: (until: number | null) => void;
}

/** Raid protection: lock for a while (nobody new joins, only moderators post), and the automatic lock and slowmode. */
function RaidCard({ orgId, settings, editable, onRaid, onLocked }: RaidCardProps) {
  const engine = useEngine();
  const lockedUntil = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.lockedUntil ?? null) ?? settings.lockedUntil;
  const lock = useAction();
  const locked = running(lockedUntil);
  return (
    <Card
      title="Raid protection"
      sub={
        locked
          ? `Locked: unlocks ${untilWhen(lockedUntil!)}${settings.lockReason === "raid" ? " (raid protection did it)" : ""}. Nobody new can join and only moderators can post.`
          : "Lock the community for a while: nobody new can join and only moderators can post."
      }
    >
      <ErrorLine text={lock.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {locked ? (
          <button className="btn btn-secondary btn-sm" disabled={lock.busy} onClick={() => void lock.act(() => lockCommunity(engine, orgId, null, true).then(() => onLocked(null)))}>
            <LockOpen size={14} /> Unlock
          </button>
        ) : (
          PROFILE_LOCK_CHOICES.map((c) => (
            <button
              key={c.duration}
              className="btn btn-secondary btn-sm"
              disabled={lock.busy}
              onClick={() => void lock.act(() => lockCommunity(engine, orgId, c, true).then(() => onLocked(Date.now() + c.ms)))}
            >
              <Lock size={14} /> Lock for {c.label.toLowerCase()}
            </button>
          ))
        )}
      </div>
      <div className="setting">
        <span className="lines">
          <strong>Automatic raid protection</strong>
          <small>Locks for 15 minutes after 60 joins in a minute, and slows a channel to one message every 5 seconds when 6 people send 30 messages in 10 seconds.</small>
        </span>
        <Toggle checked={settings.raidProtection} disabled={!editable} onChange={onRaid} label="Automatic raid protection" />
      </div>
    </Card>
  );
}
