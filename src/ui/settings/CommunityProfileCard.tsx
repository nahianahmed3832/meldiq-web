import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { communityProfile, emptyCommunityProfile, saveCommunityProfile, zCommunityProfile, type CommunityProfile } from "../../sync/communityProfile";
import { useAction, useLoad } from "../workspace/useLoad";
import { THEME_PRESETS, themeBackground } from "../people/profileTheme";
export function CommunityProfileCard({ aboutMe, pronouns }: { aboutMe: string; pronouns: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const orgs = useOrbit((s) => s.orgs);
  const on = useOrbit((s) => s.server?.features.includes("community-profiles") ?? false);
  const [orgId, setOrgId] = useState("");
  if (!on || !orgs.length) return null;
  return (
    <div className="card setting-card">
      <h2>
        <Localized k="settings.interface.community_profile_ff2cbd9" />
      </h2>
      <p className="hint">
        <Localized k="settings.interface.your_global_profile_is_the_fallback_overrides_appear_only_inside_d7fd76f" />
      </p>
      <label className="field">
        <span>{l10n("organization.community")}</span>
        <select className="input" aria-label={uiText("settings.interface.profile_community_7512cc1")} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">
            <Localized k="settings.interface.choose_a_community_15be070" />
          </option>
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
  useLocaleRender();
  const engine = useEngine();
  const userId = useOrbit((s) => s.me!.userId);
  const loaded = useLoad(() => communityProfile(engine, orgId, userId), [engine, orgId, userId]);
  const [draft, setDraft] = useState<CommunityProfile | null>(null);
  const [rev, setRev] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const action = useAction();
  useUnsavedChanges(draft !== null);
  const p = draft ?? { ...emptyCommunityProfile, ...loaded.data?.profile };
  const change = (patch: Partial<CommunityProfile>) => {
    setRev((r) => r ?? loaded.data?.rev ?? 0);
    setDraft({ ...p, ...patch });
  };
  if (!loaded.data) return <p role="status">{loaded.error ?? uiText("settings.interface.loading_community_profile_8ee453d")}</p>;
  return (
    <>
      {(["aboutMe", "pronouns"] as const).map((k) => (
        <label className="field" key={k}>
          <span>{k === "aboutMe" ? uiText("settings.interface.community_about_me_dc577fa") : uiText("settings.interface.community_pronouns_d2a8649")}</span>
          <span>
            <input type="checkbox" checked={p[k] === null} onChange={(e) => change({ [k]: e.target.checked ? null : "" })} />
            <Localized k="settings.interface.use_global_profile_fff62aa" />
          </span>
          <input
            className="input"
            aria-label={k === "aboutMe" ? uiText("settings.interface.community_about_me_dc577fa") : uiText("settings.interface.community_pronouns_d2a8649")}
            disabled={p[k] === null}
            maxLength={k === "aboutMe" ? 300 : 40}
            value={p[k] ?? (k === "aboutMe" ? aboutMe : pronouns)}
            onChange={(e) => change({ [k]: e.target.value })}
          />
        </label>
      ))}
      <label className="field">
        <span>
          <Localized k="settings.interface.community_profile_theme_5f99e0f" />
        </span>
        <select
          className="input"
          aria-label={uiText("settings.interface.community_profile_theme_5f99e0f")}
          value={p.theme ? (THEME_PRESETS.find((t) => JSON.stringify(t.colors) === JSON.stringify(p.theme))?.id ?? "custom") : ""}
          onChange={(e) => change({ theme: THEME_PRESETS.find((t) => t.id === e.target.value)?.colors ?? null })}
        >
          <option value="">
            <Localized k="settings.interface.use_global_theme_c013e01" />
          </option>
          {THEME_PRESETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          {p.theme && (
            <option value="custom">
              <Localized k="settings.interface.custom_imported_theme_38c8593" />
            </option>
          )}
        </select>
      </label>
      <div className="card setting-card" aria-label={uiText("settings.interface.community_profile_preview_e4ac2d8")} style={p.theme ? { borderColor: p.theme[0], borderTopWidth: 6 } : undefined}>
        <strong>
          <Localized k="organization.interface.preview_324b134" />
        </strong>
        {p.theme && <span style={{ height: 24, background: themeBackground(p.theme), borderRadius: 6 }} />}
        <span>{p.pronouns ?? pronouns}</span>
        <p>{p.aboutMe ?? aboutMe}</p>
        <small>
          {p.aboutMe === null && p.pronouns === null && p.theme === null
            ? uiText("settings.interface.following_global_profile_9624a5d")
            : uiText("settings.interface.overrides_apply_in_this_community_2a0ad6c")}
        </small>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" disabled={action.busy} onClick={() => change(emptyCommunityProfile)}>
          <Localized k="settings.interface.reset_to_global_88579ca" />
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
          <Localized k="settings.interface.discard_draft_cb30147" />
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
          {action.busy ? uiText("workspace.interface.applying_3329a9b") : uiText("settings.interface.apply_community_profile_dd3884c")}
        </button>
      </div>
      {action.error && (
        <p role="alert">
          <Localized k="settings.interface.your_draft_is_kept_discard_it_to_load_the_latest_version_705113c" slots={[action.error]} />
        </p>
      )}
      <details>
        <summary>
          <Localized k="settings.interface.import_or_export_profile_preset_2832c8c" />
        </summary>
        <p className="hint">
          <Localized k="settings.interface.only_text_and_one_or_two_hex_colours_treat_exported_bio_text_as_p_1aa7851" />
        </p>
        <textarea className="input" aria-label={uiText("settings.interface.community_profile_preset_json_747a125")} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setText(JSON.stringify(p, null, 2))}>
            <Localized k="settings.interface.export_preset_ae61913" />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              try {
                change(zCommunityProfile.parse(JSON.parse(text)));
                setImportError(null);
              } catch {
                setImportError(uiText("settings.interface.invalid_preset_use_aboutme_pronouns_and_theme_with_valid_text_and_a5d8a7f"));
              }
            }}
          >
            <Localized k="settings.interface.preview_imported_preset_1d51a07" />
          </button>
        </div>
        {importError && <p role="alert">{importError}</p>}
      </details>
    </>
  );
}
