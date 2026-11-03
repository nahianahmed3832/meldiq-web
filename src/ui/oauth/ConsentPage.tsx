import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { authorize, authorizeInfo, parseAuthorizeQuery, safeRedirect, SCOPE_WORDS } from "../../sync/oauth";
import { MeldlingArt } from "../components/MeldlingArt";
import { useLoad } from "../workspace/useLoad";
/** The host people are sent back to, for "You'll go back to example.com". */
export function redirectHost(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}
/**
 * /oauth/authorize (API 0.65.0 batch B): an app asks to know who you are. The request comes from the address; the
 * server checks the app and its redirect URI first (an unknown one is never sent anywhere), then Allow or Cancel sends
 * the browser back to the app. Signed out, the app shows the sign-in screen first and this page after, at the same address.
 */
export function ConsentPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const offered = useOrbit((s) => s.server?.features.includes("oauth-apps") ?? true);
  // The address as the page opened: read once, so moving away and back can't change what's approved.
  const parsed = useMemo(() => parseAuthorizeQuery(location.search), []);
  const request = "request" in parsed ? parsed.request : null;
  const info = useLoad(() => (request ? authorizeInfo(engine, request) : Promise.resolve(null)), [engine, request]);
  const [busy, setBusy] = useState<"allow" | "cancel" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const answer = async (approve: boolean) => {
    if (!request || busy) return;
    setBusy(approve ? "allow" : "cancel");
    setProblem(null);
    try {
      const to = safeRedirect(await authorize(engine, request, approve));
      if (!to) throw new Error(uiText("auth.interface.the_app_s_address_back_isn_t_one_meldiq_can_open_f3ea4c6"));
      window.location.assign(to);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
      setBusy(null);
    }
  };
  const failure = "problem" in parsed ? parsed.problem : !offered ? uiText("auth.interface.this_server_doesn_t_offer_log_in_with_meldiq_yet_890890b") : info.error;
  const i = info.data;
  return (
    <main className="consent" aria-label={uiText("auth.interface.log_in_with_meldiq_4fd2351")}>
      <div className="card consent-card">
        {failure ? (
          <>
            <MeldlingArt pose="hello" />
            <h1>
              <Localized k="auth.interface.can_t_sign_in_to_this_app_4fcf6af" />
            </h1>
            <p className="muted">{failure}</p>
            <button className="btn btn-secondary" onClick={() => navigate({ section: "home" })}>
              <Localized k="auth.interface.back_to_meldiq_f59db13" />
            </button>
          </>
        ) : !i ? (
          <div className="skeleton" style={{ height: 220 }} aria-busy="true" />
        ) : (
          <>
            <ShieldCheck size={32} className="consent-mark" aria-hidden="true" />
            <h1>
              <Localized k="auth.interface.wants_to_use_your_meldiq_account_f5a3054" slots={[<strong>{i.app.name}</strong>]} />
            </h1>
            <p className="muted">
              {i.app.ownerUsername
                ? uiText("auth.interface.made_by_value0_not_by_meldiq_e6a3715", { value0: i.app.ownerUsername })
                : uiText("auth.interface.made_by_someone_on_meldiq_not_by_meldiq_8dc124a")}
            </p>
            {me && (
              <p className="consent-who">
                <Localized k="auth.interface.signed_in_as_9678cb4" slots={[<strong>{me.displayName}</strong>, <span className="faint">@{me.username}</span>]} />
              </p>
            )}
            <h2 className="settings-group">
              <Localized k="auth.interface.it_will_be_able_to_5b8d75f" />
            </h2>
            <ul className="consent-scopes">
              {i.scopes.map((s) => (
                <li key={s.id}>
                  <Check size={15} aria-hidden="true" /> {SCOPE_WORDS[s.id] ?? s.description}
                </li>
              ))}
            </ul>
            <p className="faint consent-small">
              <Localized
                k="auth.interface.it_can_t_read_your_messages_or_post_as_you_you_ll_go_back_to_you_7be91d5"
                slots={[redirectHost(i.redirectUri), i.alreadyAuthorized ? uiText("auth.interface.you_ve_allowed_this_app_before_26b8607") : ""]}
              />
            </p>
            {problem && (
              <div className="banner danger" role="alert">
                {problem}
              </div>
            )}
            <div className="consent-actions">
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => void answer(false)}>
                {busy === "cancel" ? uiText("auth.interface.cancelling_91b104d") : l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-primary" disabled={!!busy} onClick={() => void answer(true)}>
                {busy === "allow" ? uiText("auth.interface.allowing_ff49ba8") : uiText("organization.interface.allow_e213c16")}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
