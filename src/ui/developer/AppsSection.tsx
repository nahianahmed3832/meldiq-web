import { confirmAction } from "../components/ConfirmationDialog";
import { SERVER_REFERENCE } from "../../i18n/syntax";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { AppWindow, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine } from "../../application/orbit";
import { APP_LIMIT, createApp, deleteApp, type DeveloperApp, developerApps, parseRedirectUris, rotateAppSecret, updateApp } from "../../sync/developer";
import { CopyButton, SecretBox } from "../components/CopyButton";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
/**
 * Developer › "Log in with Meldiq" apps (API 0.65.0 batch B): up to 10 apps, each an OAuth client whose ID is shown
 * here and whose secret is shown only when it's made or replaced. Redirect URIs are https, or http://localhost while
 * developing.
 */
export function AppsSection({ webOrigin }: { webOrigin: string }) {
  useLocaleRender();
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(() => developerApps(engine), [engine, version]);
  const [making, setMaking] = useState(false);
  const [secret, setSecret] = useState<{
    title: string;
    value: string;
  } | null>(null);
  const reload = () => setVersion((v) => v + 1);
  const apps = list.data ?? [];
  return (
    <section className="card ws-card" aria-label={uiText("workspace.interface.log_in_with_meldiq_apps_9bbd94e")}>
      <header className="ws-card-head">
        <div className="grow">
          <h3>
            <Localized
              k="workspace.interface.log_in_with_meldiq_apps_ee377cd"
              slots={[list.data ? uiText("workspace.interface.value0_value1_ad0489a", { value0: apps.length, value1: APP_LIMIT }) : ""]}
            />
          </h3>
          <p className="muted">
            <Localized k="workspace.interface.let_people_sign_in_to_your_website_or_app_with_their_meldiq_accou_ac3fa46" />
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!list.data || apps.length >= APP_LIMIT} onClick={() => setMaking(true)}>
          <Localized k="workspace.interface.new_app_189a110" slots={[<Plus size={14} />]} />
        </button>
      </header>
      {secret && <SecretBox title={secret.title} secret={secret.value} onDone={() => setSecret(null)} />}
      {making && (
        <AppForm
          submitLabel={uiText("workspace.interface.make_app_a494d42")}
          onCancel={() => setMaking(false)}
          onSubmit={async (name, uris) => {
            const made = await createApp(engine, name, uris);
            setSecret({ title: uiText("workspace.interface.value0_s_client_secret_ff01a00", { value0: made.app.name }), value: made.clientSecret });
            setMaking(false);
            reload();
          }}
        />
      )}
      {list.error && (
        <div className="banner danger" role="alert">
          {list.error}
        </div>
      )}
      {list.data && apps.length === 0 && !making && (
        <p className="faint">
          <Localized k="workspace.interface.no_apps_yet_f748a85" />
        </p>
      )}
      <ul className="ws-list dev-list">
        {apps.map((a) => (
          <AppRow key={a.id} app={a} onChanged={reload} onSecret={(value) => setSecret({ title: uiText("workspace.interface.value0_s_new_client_secret_c35c401", { value0: a.name }), value })} />
        ))}
      </ul>
      <HowAppsWork webOrigin={webOrigin} />
    </section>
  );
}
interface AppFormProps {
  initialName?: string;
  initialUris?: string[];
  /** Renaming isn't offered when only the redirect URIs are edited. */
  nameEditable?: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (name: string, uris: string[]) => Promise<void>;
}
function AppForm({ initialName = "", initialUris = [], nameEditable = true, submitLabel, onCancel, onSubmit }: AppFormProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const [name, setName] = useState(initialName);
  const [uris, setUris] = useState(initialUris.join("\n"));
  const [problem, setProblem] = useState<string | null>(null);
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseRedirectUris(uris);
    const bad = !name.trim() ? uiText("workspace.interface.give_the_app_a_name_f885e78") : "problem" in parsed ? parsed.problem : null;
    setProblem(bad);
    if (bad || "problem" in parsed) return;
    void act.act(() => onSubmit(name.trim(), parsed.uris));
  };
  return (
    <form className="ws-form" onSubmit={submit} noValidate aria-label={submitLabel}>
      {nameEditable && (
        <label className="field ws-wide">
          <span>
            <Localized k="workspace.interface.app_name_e6ad399" />
          </span>
          <input className="input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label className="field ws-wide">
        <span>
          <Localized k="workspace.interface.redirect_uris_one_per_line_81a200d" />
        </span>
        <textarea className="input" rows={3} placeholder="https://example.com/auth/meldiq" value={uris} onChange={(e) => setUris(e.target.value)} />
        <small className="faint">
          <Localized k="workspace.interface.where_meldiq_sends_people_back_after_they_say_yes_https_or_http_l_d7f37fa" />
        </small>
      </label>
      {(problem || act.error) && (
        <div className="banner danger ws-wide" role="alert">
          {problem ?? act.error}
        </div>
      )}
      <div className="ws-form-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          {l10n("common.actions.cancel")}
        </button>
        <button className="btn btn-primary btn-sm" disabled={act.busy}>
          {act.busy ? l10n("common.common_saving") : submitLabel}
        </button>
      </div>
    </form>
  );
}
function AppRow({ app, onChanged, onSecret }: { app: DeveloperApp; onChanged: () => void; onSecret: (secret: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const act = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <li className="dev-item">
      <div className="ws-row">
        <AppWindow size={18} className="faint" />
        <span className="lines grow">
          <span className="ellipsis">{app.name}</span>
          <small>
            <Localized
              k="workspace.interface.redirect_secret_from_d37afb2"
              slots={[app.redirectUris.length, app.redirectUris.length === 1 ? uiText("workspace.interface.uri_d70fbad") : uiText("workspace.interface.uris_6b11ae3"), relative(app.secretRotatedAt)]}
            />
          </small>
        </span>
      </div>
      <div className="row dev-actions">
        <span className="faint">
          <Localized k="workspace.interface.client_id_8726db0" />
        </span>
        <code className="ellipsis">{app.id}</code>
        <CopyButton text={app.id} label={uiText("workspace.interface.copy_value0_s_client_id_d517d49", { value0: app.name })} />
        <span className="grow" />
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>
          <Localized k="workspace.interface.redirect_uris_bc8f808" slots={[<Pencil size={14} />]} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={act.busy}
          onClick={async () => {
            if (!(await confirmAction(uiText("workspace.interface.replace_value0_s_client_secret_the_current_one_stops_working_at_o_1c57d14", { value0: app.name })))) return;
            void act.act(async () => onSecret((await rotateAppSecret(engine, app.id)).clientSecret));
          }}
        >
          <Localized k="workspace.interface.new_secret_8970337" slots={[<KeyRound size={14} />]} />
        </button>
        <button
          className="btn btn-danger-quiet btn-sm"
          disabled={act.busy}
          onClick={async () => {
            if (await confirmAction(uiText("workspace.interface.delete_value0_everyone_signed_in_to_it_with_meldiq_is_signed_out_3eeffc9", { value0: app.name })))
              void act.act(() => deleteApp(engine, app.id).then(onChanged));
          }}
        >
          <Trash2 size={14} /> {l10n("common.actions.delete")}
        </button>
      </div>
      {editing ? (
        <AppForm
          initialName={app.name}
          initialUris={app.redirectUris}
          nameEditable={false}
          submitLabel={l10n("common.actions.save")}
          onCancel={() => setEditing(false)}
          onSubmit={async (_name, uris) => {
            await updateApp(engine, app.id, { redirectUris: uris });
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <ul className="dev-uris">
          {app.redirectUris.map((u) => (
            <li key={u}>
              <code>{u}</code>
            </li>
          ))}
        </ul>
      )}
      {act.error && (
        <div className="banner danger" role="alert">
          {act.error}
        </div>
      )}
    </li>
  );
}
function HowAppsWork({ webOrigin }: { webOrigin: string }) {
  useLocaleRender();
  return (
    <details className="dev-how">
      <summary>
        <Localized k="workspace.interface.how_log_in_with_meldiq_works_5341bc4" />
      </summary>
      <ol>
        <li>
          <Localized
            k="workspace.interface.send_people_to_with_and_if_you_need_it_and_for_apps_without_a_ser_99f391c"
            slots={[
              <code>{webOrigin}/oauth/authorize</code>,
              <code>client_id</code>,
              <code>redirect_uri</code>,
              <code>{"scope"}</code>,
              <code>{"identify"}</code>,
              <code>{"email"}</code>,
              <code>{"state"}</code>,
              <code>code_challenge</code>,
              <code>{"code_challenge_method=S256"}</code>,
            ]}
          />
        </li>
        <li>
          <Localized k="workspace.interface.they_see_your_app_s_name_and_what_it_gets_and_choose_allow_or_can_cb75b59" />
        </li>
        <li>
          <Localized
            k="workspace.interface.your_server_swaps_the_code_at_for_tokens_then_reads_who_they_are_d9aefd1"
            slots={[<code>{"POST /v2/oauth/token"}</code>, <code>{"GET /v2/oauth/userinfo"}</code>]}
          />
        </li>
        <li>
          <Localized k="workspace.interface.people_can_remove_your_app_s_access_any_time_in_privacy_security_cb20335" />
        </li>
      </ol>
      <small className="faint">
        <Localized
          k="workspace.interface.the_full_reference_is_the_log_in_with_meldiq_section_of_docs_sett_dd2bca4"
          slots={[<code dir="ltr">{SERVER_REFERENCE.login}</code>, <code dir="ltr">{SERVER_REFERENCE.path}</code>]}
        />
      </small>
    </details>
  );
}
