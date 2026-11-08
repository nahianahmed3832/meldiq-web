import { CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { partnerApplication, partnerEligibility, submitPartnerApplication, PARTNER_ELIGIBILITY_FEATURE, type PartnerChecklist, type PartnerEligibility } from "../../sync/partners";
import { Card, ErrorLine } from "../components/SettingsCard";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { useAction, useLoad } from "./useLoad";
const EMPTY: PartnerChecklist = { guidelines: false, moderation: false, safety: false, activity: false };
const KEYS = ["guidelines", "moderation", "safety", "activity"] as const;
export function PartnerApplicationCard({ orgId }: { orgId: string }) {
  const engine = useEngine(),
    t = useT();
  const gated = useOrbit((state) => state.server?.features.includes(PARTNER_ELIGIBILITY_FEATURE) ?? false);
  const qualification = useLoad(() => (gated ? partnerEligibility(engine, orgId) : Promise.resolve(null)), [engine, orgId, gated]);
  const loaded = useLoad(() => partnerApplication(engine, orgId), [engine, orgId]);
  const [statement, setStatement] = useState(""),
    [checklist, setChecklist] = useState<PartnerChecklist>(EMPTY);
  const action = useAction();
  useEffect(() => {
    if (!loaded.loading && !loaded.error) {
      setStatement(loaded.data?.statement ?? "");
      setChecklist(loaded.data?.checklist ?? EMPTY);
    }
  }, [loaded.data, loaded.loading, loaded.error]);
  const readOnly = loaded.data?.status === "approved";
  const dirty = statement !== (loaded.data?.statement ?? "") || KEYS.some((k) => checklist[k] !== (loaded.data?.checklist[k] ?? false));
  useUnsavedChanges(dirty && !readOnly);
  const save = () =>
    void action.act(async () => {
      await submitPartnerApplication(engine, orgId, loaded.data?.rev ?? 0, statement.trim(), checklist);
      loaded.reload();
    });
  return (
    <>
      {gated && qualification.error && <ErrorLine text={qualification.error} />}
      {gated && qualification.loading && <p role="status">{t("common.status.loading")}</p>}
      {qualification.data && <Requirements data={qualification.data} />}
      {(!gated || qualification.data?.eligible || loaded.data) && (
        <Card title={t("workspace.partners.label")} sub={t(gated ? "workspace.reference.partnerApplicationIntro" : "workspace.partners.intro")}>
          <ErrorLine text={loaded.error ?? action.error} />
          {loaded.error && (
            <button className="btn btn-secondary" onClick={loaded.reload}>
              {t("common.actions.retry")}
            </button>
          )}
          {loaded.loading && <p role="status">{t("common.status.loading")}</p>}
          {loaded.data && (
            <p className="banner info" role="status">
              {loaded.data.status === "approved"
                ? t("workspace.interface.approved_87b42e4")
                : loaded.data.status === "submitted"
                  ? t("workspace.interface.pending_331551b")
                  : t("workspace.interface.declined_by_value0_5dc71e2", { value0: "Meldiq" })}
            </p>
          )}
          {loaded.data?.reviewNote && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{loaded.data.reviewNote}</p>}
          <fieldset
            disabled={readOnly || loaded.loading || !!loaded.error || action.busy || (gated && !qualification.data?.eligible)}
            style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 12 }}
          >
            <label className="field">
              <span>{t("workspace.partners.statement")}</span>
              <textarea className="input" rows={4} maxLength={2000} value={statement} onChange={(e) => setStatement(e.target.value)} />
            </label>
            {KEYS.map((k) => (
              <label key={k} className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={checklist[k]} onChange={(e) => setChecklist((c) => ({ ...c, [k]: e.target.checked }))} />
                {t(`workspace.partners.${k}`)}
              </label>
            ))}
            {!readOnly && (
              <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={!statement.trim() || !KEYS.every((k) => checklist[k]) || !dirty} onClick={save}>
                {t("settings.interface.send_it_in_9ad0aab")}
              </button>
            )}
          </fieldset>
        </Card>
      )}
    </>
  );
}

function Requirements({ data }: { data: PartnerEligibility }) {
  const t = useT();
  const level = data.activeSparks >= 14 ? 3 : data.activeSparks >= 7 ? 2 : data.activeSparks >= 2 ? 1 : 0;
  const verification = ["medium", "high", "highest"].includes(data.verification);
  const entries = [
    { name: t("workspace.reference.partnerLevel"), pass: level >= 2, value: t("billing.interface.level_value0_6095a3d", { value0: level }) },
    { name: t("workspace.reference.partnerMembers"), pass: data.members >= 1000, value: t("workspace.reference.partnerMemberCount", { count: data.members }) },
    { name: t("workspace.reference.partnerRules"), pass: data.hasRules },
    { name: t("workspace.reference.partnerMods"), pass: data.activeMods >= 2, value: t("workspace.reference.partnerModCount", { count: data.activeMods }) },
    { name: t("workspace.reference.partnerVerification"), pass: verification },
    { name: t("workspace.reference.partnerAge"), pass: data.ageDays >= 10, value: t("workspace.reference.partnerDayCount", { count: data.ageDays }) },
    { name: t("workspace.reference.partnerStanding"), pass: data.cleanStanding },
  ];
  return (
    <section className="ws-partner-requirements" aria-label={t("workspace.reference.partnerRequirements")}>
      <p className="muted">{t("workspace.reference.partnerApplicationIntro")}</p>
      <h2>{t("workspace.reference.partnerRequirements")}</h2>
      <ul>
        {entries.map(({ name, pass, value }) => (
          <li key={name}>
            {pass ? <CircleCheck size={20} className="requirement-pass" aria-hidden /> : <CircleX size={20} className="requirement-fail" aria-hidden />}
            <strong className="grow">{name}</strong>
            <span className="sr-only">{t(pass ? "workspace.reference.partnerMet" : "workspace.reference.partnerMissing")}</span>
            {value && <span className="muted">{value}</span>}
          </li>
        ))}
      </ul>
      {!data.eligible && <p className="muted">{t("workspace.reference.partnerLocked")}</p>}
    </section>
  );
}
