import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
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
        <Localized k="files.interface.safety_726d11b" />
      </h2>
      {safety && <SafetyCards detail={detail} />}
      {security && <SecurityPage detail={detail} />}
    </section>
  );
}
function SafetyCards({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
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
        <Card title={uiText("organization.interface.who_can_post_cabffe4")} sub={uiText("files.interface.moderators_people_with_a_role_and_bots_skip_these_checks_1b68751")}>
          <ErrorLine text={save.error} />
          <label className="field">
            <span>
              <Localized k="files.interface.verification_level_8cbdf32" />
            </span>
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
            <span>
              <Localized k="files.interface.new_accounts_38586d6" />
            </span>
            <select className="input" value={current.newAccountGate} disabled={save.busy} onChange={(e) => change({ newAccountGate: e.target.value as AccountAgeGate })}>
              {ACCOUNT_AGE_CHOICES.map((c) => (
                <option key={c.gate} value={c.gate}>
                  {c.label}
                </option>
              ))}
            </select>
            <small className="faint">
              <Localized k="files.interface.accounts_this_new_can_t_join_moderators_and_meldiq_staff_are_neve_02648dd" />
            </small>
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const lockedUntil = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.lockedUntil ?? null) ?? settings.lockedUntil;
  const lock = useAction();
  const locked = running(lockedUntil);
  return (
    <Card
      title={uiText("files.interface.raid_protection_675bdb8")}
      sub={
        locked
          ? uiText("files.interface.locked_unlocks_value0_value1_nobody_new_can_join_and_only_moderat_3be3f52", {
              value0: untilWhen(lockedUntil!),
              value1: settings.lockReason === "raid" ? uiText("workspace.interface.raid_protection_did_it_b52eb45") : "",
            })
          : uiText("files.interface.lock_the_community_for_a_while_nobody_new_can_join_and_only_moder_5c2424b")
      }
    >
      <ErrorLine text={lock.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {locked ? (
          <button className="btn btn-secondary btn-sm" disabled={lock.busy} onClick={() => void lock.act(() => lockCommunity(engine, orgId, null, true).then(() => onLocked(null)))}>
            <LockOpen size={14} /> {l10n("onboarding.setup_unlock")}
          </button>
        ) : (
          PROFILE_LOCK_CHOICES.map((c) => (
            <button
              key={c.duration}
              className="btn btn-secondary btn-sm"
              disabled={lock.busy}
              onClick={() => void lock.act(() => lockCommunity(engine, orgId, c, true).then(() => onLocked(Date.now() + c.ms)))}
            >
              <Localized k="files.interface.lock_for_5c051c5" slots={[<Lock size={14} />, c.label.toLowerCase()]} />
            </button>
          ))
        )}
      </div>
      <div className="setting">
        <span className="lines">
          <strong>
            <Localized k="files.interface.automatic_raid_protection_ba2a1f9" />
          </strong>
          <small>
            <Localized k="files.interface.locks_for_15_minutes_after_60_joins_in_a_minute_and_slows_a_chann_1c67890" />
          </small>
        </span>
        <Toggle checked={settings.raidProtection} disabled={!editable} onChange={onRaid} label={uiText("files.interface.automatic_raid_protection_ba2a1f9")} />
      </div>
    </Card>
  );
}
