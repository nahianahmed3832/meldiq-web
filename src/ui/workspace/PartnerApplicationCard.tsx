import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import { useT } from "../../i18n";
import { partnerApplication, submitPartnerApplication, type PartnerChecklist } from "../../sync/partners";
import { Card, ErrorLine } from "../components/SettingsCard";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { useAction, useLoad } from "./useLoad";
const EMPTY: PartnerChecklist = { guidelines: false, moderation: false, safety: false, activity: false };
const KEYS = ["guidelines", "moderation", "safety", "activity"] as const;
export function PartnerApplicationCard({ orgId }: { orgId: string }) {
  const engine = useEngine(),
    t = useT();
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
    <Card title={t("workspace.partners.label")} sub={t("workspace.partners.intro")}>
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
      <fieldset disabled={readOnly || loaded.loading || !!loaded.error || action.busy} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 12 }}>
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
  );
}
