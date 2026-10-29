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
      if (!to) throw new Error("The app's address back isn't one Meldiq can open.");
      window.location.assign(to);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't work. Try again.");
      setBusy(null);
    }
  };

  const failure = "problem" in parsed ? parsed.problem : !offered ? "This server doesn't offer “Log in with Meldiq” yet." : info.error;
  const i = info.data;
  return (
    <main className="consent" aria-label="Log in with Meldiq">
      <div className="card consent-card">
        {failure ? (
          <>
            <MeldlingArt pose="hello" />
            <h1>Can't sign in to this app</h1>
            <p className="muted">{failure}</p>
            <button className="btn btn-secondary" onClick={() => navigate({ section: "home" })}>
              Back to Meldiq
            </button>
          </>
        ) : !i ? (
          <div className="skeleton" style={{ height: 220 }} aria-busy="true" />
        ) : (
          <>
            <ShieldCheck size={32} className="consent-mark" aria-hidden="true" />
            <h1>
              <strong>{i.app.name}</strong> wants to use your Meldiq account
            </h1>
            <p className="muted">{i.app.ownerUsername ? `Made by @${i.app.ownerUsername}, not by Meldiq.` : "Made by someone on Meldiq, not by Meldiq."}</p>
            {me && (
              <p className="consent-who">
                Signed in as <strong>{me.displayName}</strong> <span className="faint">@{me.username}</span>
              </p>
            )}
            <h2 className="settings-group">It will be able to</h2>
            <ul className="consent-scopes">
              {i.scopes.map((s) => (
                <li key={s.id}>
                  <Check size={15} aria-hidden="true" /> {SCOPE_WORDS[s.id] ?? s.description}
                </li>
              ))}
            </ul>
            <p className="faint consent-small">
              It can't read your messages or post as you. You'll go back to {redirectHost(i.redirectUri)}. You can remove its access any time in Privacy & security › Authorised apps.
              {i.alreadyAuthorized ? " You've allowed this app before." : ""}
            </p>
            {problem && (
              <div className="banner danger" role="alert">
                {problem}
              </div>
            )}
            <div className="consent-actions">
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => void answer(false)}>
                {busy === "cancel" ? "Cancelling…" : "Cancel"}
              </button>
              <button className="btn btn-primary" disabled={!!busy} onClick={() => void answer(true)}>
                {busy === "allow" ? "Allowing…" : "Allow"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
