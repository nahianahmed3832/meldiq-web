import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { communityProfile, emptyCommunityProfile, saveCommunityProfile, zCommunityProfile, type CommunityProfile } from "../../sync/communityProfile";
import { useAction, useLoad } from "../workspace/useLoad";
import { THEME_PRESETS, themeBackground } from "../people/profileTheme";
export function CommunityProfileCard({ aboutMe, pronouns }: { aboutMe: string; pronouns: string }) {
  const orgs = useOrbit((s) => s.orgs);
  const on = useOrbit((s) => s.server?.features.includes("community-profiles") ?? false);
  const [orgId, setOrgId] = useState("");
  if (!on || !orgs.length) return null;
  return (
    <div className="card setting-card">
      <h2>Community profile</h2>
      <p className="hint">
        Your global profile is the fallback. Overrides appear only inside the chosen community and follow your global bio privacy. Role name colours stay in control of community names.
      </p>
      <label className="field">
        <span>Community</span>
        <select className="input" aria-label="Profile community" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">Choose a community</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {orgId && orgs.some((o) => o.id === orgId) && <CommunityProfileEditor key={orgId} orgId={orgId} aboutMe={aboutMe} pronouns={pronouns} />}
    </div>
  );
}
function CommunityProfileEditor({ orgId, aboutMe, pronouns }: { orgId: string; aboutMe: string; pronouns: string }) {
  const engine = useEngine();
  const userId = useOrbit((s) => s.me!.userId);
  const loaded = useLoad(() => communityProfile(engine, orgId, userId), [engine, orgId, userId]);
  const [draft, setDraft] = useState<CommunityProfile | null>(null);
  const [rev, setRev] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const action = useAction();
  const p = draft ?? { ...emptyCommunityProfile, ...loaded.data?.profile };
  const change = (patch: Partial<CommunityProfile>) => {
    setRev((r) => r ?? loaded.data?.rev ?? 0);
    setDraft({ ...p, ...patch });
  };
  if (!loaded.data) return <p role="status">{loaded.error ?? "Loading community profile…"}</p>;
  return (
    <>
      {(["aboutMe", "pronouns"] as const).map((k) => (
        <label className="field" key={k}>
          <span>{k === "aboutMe" ? "Community about me" : "Community pronouns"}</span>
          <span>
            <input type="checkbox" checked={p[k] === null} onChange={(e) => change({ [k]: e.target.checked ? null : "" })} /> Use global profile
          </span>
          <input
            className="input"
            aria-label={k === "aboutMe" ? "Community about me" : "Community pronouns"}
            disabled={p[k] === null}
            maxLength={k === "aboutMe" ? 300 : 40}
            value={p[k] ?? (k === "aboutMe" ? aboutMe : pronouns)}
            onChange={(e) => change({ [k]: e.target.value })}
          />
        </label>
      ))}
      <label className="field">
        <span>Community profile theme</span>
        <select
          className="input"
          aria-label="Community profile theme"
          value={p.theme ? (THEME_PRESETS.find((t) => JSON.stringify(t.colors) === JSON.stringify(p.theme))?.id ?? "custom") : ""}
          onChange={(e) => change({ theme: THEME_PRESETS.find((t) => t.id === e.target.value)?.colors ?? null })}
        >
          <option value="">Use global theme</option>
          {THEME_PRESETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          {p.theme && <option value="custom">Custom imported theme</option>}
        </select>
      </label>
      <div className="card setting-card" aria-label="Community profile preview" style={p.theme ? { borderColor: p.theme[0], borderTopWidth: 6 } : undefined}>
        <strong>Preview</strong>
        {p.theme && <span style={{ height: 24, background: themeBackground(p.theme), borderRadius: 6 }} />}
        <span>{p.pronouns ?? pronouns}</span>
        <p>{p.aboutMe ?? aboutMe}</p>
        <small>{p.aboutMe === null && p.pronouns === null && p.theme === null ? "Following global profile" : "Overrides apply in this community"}</small>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" disabled={action.busy} onClick={() => change(emptyCommunityProfile)}>
          Reset to global
        </button>
        <button
          className="btn btn-secondary"
          disabled={!draft || action.busy}
          onClick={() => {
            setDraft(null);
            setRev(null);
            loaded.reload();
          }}
        >
          Discard draft
        </button>
        <button
          className="btn btn-primary"
          disabled={!draft || action.busy}
          onClick={() =>
            void action.act(async () => {
              await saveCommunityProfile(engine, orgId, userId, rev ?? loaded.data!.rev, p);
              setDraft(null);
              setRev(null);
              loaded.reload();
              await engine.refreshAll();
            })
          }
        >
          {action.busy ? "Applying…" : "Apply community profile"}
        </button>
      </div>
      {action.error && <p role="alert">{action.error} Your draft is kept. Discard it to load the latest version.</p>}
      <details>
        <summary>Import or export profile preset</summary>
        <p className="hint">Only text and one or two hex colours. Treat exported bio text as personal information.</p>
        <textarea className="input" aria-label="Community profile preset JSON" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setText(JSON.stringify(p, null, 2))}>
            Export preset
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              try {
                change(zCommunityProfile.parse(JSON.parse(text)));
                setImportError(null);
              } catch {
                setImportError("Invalid preset. Use aboutMe, pronouns and theme with valid text and hex colours.");
              }
            }}
          >
            Preview imported preset
          </button>
        </div>
        {importError && <p role="alert">{importError}</p>}
      </details>
    </>
  );
}
