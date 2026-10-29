import { useEffect, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { ACCOUNT_AGE_CHOICES, PARITY_FEATURES, setJoinChecks, VERIFICATION_LEVELS, type VerificationLevel } from "../../sync/communityParity";
import { SecurityPage } from "./ModerationPages";
import { useAction } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

interface ProfileSafetyProps {
  detail: OrgAdminDetail;
  /** Opened from an old Security actions link: scroll here. */
  focused: boolean;
}

/**
 * Profile's safety section (the reference keeps raid protection and verification on its server profile): Security
 * actions (pause joining, pause new DMs, activity alerts), then the join checks once the server has them.
 */
export function ProfileSafety({ detail, focused }: ProfileSafetyProps) {
  const features = useOrbit((s) => s.server?.features ?? []);
  const ref = useRef<HTMLElement>(null);
  const { permissions: can } = detail;
  const security = features.includes("security-actions") && (can.canManageOrg || can.canBan);
  const checks = features.includes(PARITY_FEATURES.settingsPlus) && can.canManageOrg;
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" });
  }, [focused]);
  if (!security && !checks) return null;
  return (
    <section ref={ref} className="ws-page" aria-labelledby="ws-safety-title">
      <h2 id="ws-safety-title" className="ws-subhead">
        Safety
      </h2>
      {security && <SecurityPage detail={detail} />}
      {checks && <JoinChecksCard orgId={detail.org.id} />}
    </section>
  );
}

/**
 * Who may post after joining, and how old an account must be to join. Moderators and people with roles skip both.
 * TODO(community-parity A): start from the org's verificationLevel and minAccountAgeMs (CommunityParityFields).
 */
function JoinChecksCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [level, setLevel] = useState<VerificationLevel>("none");
  const [minAge, setMinAge] = useState<number | null>(null);
  const save = useAction();
  const change = (c: { verificationLevel?: VerificationLevel; minAccountAgeMs?: number | null }) => void save.act(() => setJoinChecks(engine, orgId, c));
  return (
    <Card title="Join checks" sub="Moderators, people with roles and bots skip these.">
      <ErrorLine text={save.error} />
      <div className="field">
        <span className="label">Verification level</span>
        <div className="segmented" role="radiogroup" aria-label="Verification level">
          {VERIFICATION_LEVELS.map((v) => (
            <button
              key={v.level}
              role="radio"
              aria-checked={level === v.level}
              aria-pressed={level === v.level}
              title={v.hint}
              disabled={save.busy}
              onClick={() => {
                setLevel(v.level);
                change({ verificationLevel: v.level });
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <small className="faint">{VERIFICATION_LEVELS.find((v) => v.level === level)?.hint}</small>
      </div>
      <div className="field">
        <span className="label">New accounts can't join if younger than</span>
        <div className="segmented" role="radiogroup" aria-label="Youngest account that can join">
          {ACCOUNT_AGE_CHOICES.map((c) => (
            <button
              key={c.label}
              role="radio"
              aria-checked={minAge === c.ms}
              aria-pressed={minAge === c.ms}
              disabled={save.busy}
              onClick={() => {
                setMinAge(c.ms);
                change({ minAccountAgeMs: c.ms });
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
