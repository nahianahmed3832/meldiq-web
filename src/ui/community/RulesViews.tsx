import { BookText, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { useT } from "../../i18n";
import { agreeToRules, communityRules, type Rule, type RulesSummary } from "../../sync/rulesChannel";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "../workspace/useLoad";

/**
 * The community's rules for members (API 0.65.0, feature rules-channel): read at the top of the rules channel and in a
 * dialog, with "I agree" when the community asks for it. The agree bar takes the composer's place until then.
 */

/** [orgId]'s rules channel summary from the community list, or null. */
export function useRulesSummary(orgId: string | null | undefined): RulesSummary | null {
  return useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId)?.rulesChannel ?? null) : null));
}

/** The numbered rules, each title with its description under it. */
export function RulesList({ rules }: { rules: readonly Rule[] }) {
  return (
    <ol className="rules-list">
      {rules.map((r, i) => (
        <li key={r.id} className="rules-item">
          <span className="rules-num" aria-hidden>
            {i + 1}
          </span>
          <div className="lines">
            <strong>{r.title}</strong>
            {r.description && <p>{r.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The rules as the server has them now, reloaded whenever the community's summary changes. */
function useRules(orgId: string) {
  const engine = useEngine();
  const summary = useRulesSummary(orgId);
  const plain = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.rules ?? null);
  const loaded = useLoad(() => communityRules(engine, orgId), [engine, orgId, summary?.count, summary?.required, summary?.channelId]);
  return { summary, plain, loaded };
}

function RulesBody({ orgId }: { orgId: string }) {
  const t = useT();
  const { plain, loaded } = useRules(orgId);
  if (loaded.error && !loaded.data) return <p className="danger-text">{t("rules_failed")}</p>;
  if (!loaded.data) return <p className="faint">{t("rules_loading")}</p>;
  if (loaded.data.rules.length) return <RulesList rules={loaded.data.rules} />;
  // A community that only wrote its rules as plain text (before the numbered list).
  return plain ? <p className="rules-plain">{plain}</p> : <p className="faint">{t("rules_none")}</p>;
}

/** "I agree", for someone the community still asks; nothing once they have agreed. */
function AgreeButton({ orgId, onAgreed }: { orgId: string; onAgreed?: () => void }) {
  const engine = useEngine();
  const t = useT();
  const summary = useRulesSummary(orgId);
  const agree = useAction();
  if (!summary?.mustAgree) {
    return summary?.agreedAt ? (
      <p className="ok-text row" style={{ gap: 6 }}>
        <CheckCircle2 size={16} aria-hidden /> {t("rules_agreed")}
      </p>
    ) : null;
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {agree.error && (
        <div className="banner danger" role="alert">
          {agree.error}
        </div>
      )}
      <button className="btn btn-primary" disabled={agree.busy} onClick={() => void agree.act(() => agreeToRules(engine, orgId)).then((ok) => ok && onAgreed?.())}>
        {agree.busy ? t("rules_agreeing") : t("rules_agree")}
      </button>
    </div>
  );
}

/** The rules in a dialog, with "I agree" and a way to the rules channel. */
export function RulesDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const t = useT();
  const summary = useRulesSummary(orgId);
  const name = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.name ?? "");
  const channelId = summary?.channelId ?? null;
  return (
    <Dialog
      title={t("rules_title")}
      subtitle={name}
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 8, justifyContent: "space-between", width: "100%" }}>
          {channelId ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onClose();
                navigate({ section: "home", conversationId: channelId });
              }}
            >
              {t("rules_open_channel")}
            </button>
          ) : (
            <span />
          )}
          <AgreeButton orgId={orgId} onAgreed={onClose} />
        </div>
      }
    >
      <RulesBody orgId={orgId} />
    </Dialog>
  );
}

/** In place of the composer while the community asks this account to agree first. */
export function RulesAgreeBar({ orgId }: { orgId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="composer-wrap">
      <div className="composer-locked rules-agree-bar" role="note">
        <BookText size={16} aria-hidden />
        <span className="grow">{t("rules_agree_prompt")}</span>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          {t("rules_read")}
        </button>
      </div>
      {open && <RulesDialog orgId={orgId} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The top of the rules channel: the rules themselves, and "I agree" when asked. */
export function RulesChannelStart({ orgId }: { orgId: string }) {
  const t = useT();
  return (
    <div className="conv-start rules-start">
      <span className="empty-orb" style={{ width: 52, height: 52 }}>
        <BookText size={22} />
      </span>
      <h2>{t("rules_title")}</h2>
      <RulesBody orgId={orgId} />
      <div style={{ justifySelf: "start" }}>
        <AgreeButton orgId={orgId} />
      </div>
    </div>
  );
}
