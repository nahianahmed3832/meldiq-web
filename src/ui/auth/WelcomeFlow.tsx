import { ArrowLeft, ArrowRight, Camera, Compass, MessagesSquare, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { saveWelcomeStage } from "../../application/welcome";
import { AccountApi } from "../../auth/accountApi";
import { useT } from "../../i18n";
import { nameProblem } from "../../auth/rules";
import { setMyPhoto, updateMyProfile } from "../../sync/profile";
import { ThemeChoice, PaletteChoice } from "../components/AppearanceControls";
import { LanguagePicker } from "../components/LanguagePicker";
import { MeldlingArt } from "../components/MeldlingArt";
import { UserAvatar } from "../components/OrgAvatar";
import { SetupProgress } from "../components/SetupProgress";
import { StatePanel } from "../components/StatePanel";
import { squareJpeg } from "../workspace/photo";
import { useAction } from "../workspace/useLoad";
import { FormError } from "./AuthFrame";
import { Field } from "./AccountForms";

/** After identity/key setup, never a replacement for it. Existing accounts are not enrolled automatically. */
export function WelcomeFlow({ accountId, stage, onFinish }: { accountId: string; stage: number; onFinish: (destination: "home" | "dms" | "discover") => void }) {
  const engine = useEngine();
  const me = useOrbit((state) => state.me);
  const synced = useOrbit((state) => state.synced);
  const photoRev = useOrbit((state) => (state.me ? state.users[state.me.userId]?.photoRev : null));
  const [name, setName] = useState("");
  const initialName = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const save = useAction();
  const photo = useAction();
  const t = useT();
  useEffect(() => {
    if (synced && me && initialName.current === null) {
      initialName.current = me.displayName;
      setName(me.displayName);
    }
  }, [me, synced]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [stage, synced]);
  const next = () => saveWelcomeStage(accountId, Math.min(stage + 1, 2));
  const finish = (destination: "home" | "dms" | "discover") => {
    saveWelcomeStage(accountId, -1);
    onFinish(destination);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (nameProblem(name) || photo.busy || save.busy) return;
    void save.act(async () => {
      const trimmed = name.trim();
      if (trimmed !== engine.state.get().me?.displayName) await updateMyProfile(engine, { displayName: trimmed });
      if (trimmed !== initialName.current && engine.device.account) await new AccountApi(engine.api).rename(trimmed);
      initialName.current = trimmed;
      next();
    });
  };
  return (
    <main className="welcome-layout" aria-labelledby="welcome-title">
      <aside className="welcome-story">
        <MeldlingArt pose="hello" size={150} />
        <h1 id="welcome-title">{t("onboarding.welcome")}</h1>
        <p>{t("onboarding.foundation.welcomeBody")}</p>
        <div className="welcome-trust">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>{t("onboarding.foundation.permissions")}</span>
        </div>
      </aside>
      <section className="welcome-card">
        <SetupProgress labels={[t("settings.settings_profile"), t("settings.navigation.preferences"), t("onboarding.foundation.ready")]} current={stage} />
        {!synced || !me ? (
          <StatePanel loading title={t("workspace.interface.opening_your_conversations_3af7cb1")} />
        ) : (
          <>
            <header className="welcome-heading">
              <h2 ref={heading} tabIndex={-1}>
                {t(stage === 0 ? "onboarding.createProfile" : stage === 1 ? "settings.navigation.preferences" : "onboarding.foundation.ready")}
              </h2>
              <p className="muted">{t(stage === 0 ? "onboarding.foundation.profileBody" : stage === 1 ? "onboarding.foundation.preferencesBody" : "onboarding.foundation.startBody")}</p>
            </header>
            {stage === 0 && (
              <form className="welcome-form" onSubmit={submit} noValidate>
                <div className="welcome-avatar">
                  <UserAvatar userId={me.userId} name={name || me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={80} decorative />
                  <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => {
                      const image = event.target.files?.[0];
                      if (image) void photo.act(async () => setMyPhoto(engine, await squareJpeg(image)));
                      event.target.value = "";
                    }}
                  />
                  <button type="button" className="btn btn-secondary" disabled={photo.busy || save.busy} onClick={() => file.current?.click()}>
                    <Camera size={16} />
                    {t(photoRev ? "settings.interface.change_photo_c5fbcb8" : "settings.interface.add_photo_c0660be")}
                  </button>
                </div>
                <Field id="welcome-name" label={t("settings.interface.display_name_2b7f6a8")}>
                  <input id="welcome-name" className="input" autoComplete="nickname" maxLength={80} value={name} disabled={save.busy} onChange={(event) => setName(event.target.value)} />
                </Field>
                <FormError text={save.error ?? photo.error ?? (name ? nameProblem(name) : null)} />
                <button className="btn btn-primary btn-lg" disabled={save.busy || photo.busy || !!nameProblem(name)}>
                  {save.busy ? t("common.common_saving") : t("common_continue")}
                  <ArrowRight size={17} />
                </button>
              </form>
            )}
            {stage === 1 && (
              <div className="welcome-form">
                <div className="welcome-preference">
                  <strong>{t("ap_theme")}</strong>
                  <ThemeChoice />
                </div>
                <div className="welcome-preference">
                  <strong>{t("ap_colour")}</strong>
                  <PaletteChoice />
                </div>
                <div className="welcome-preference">
                  <strong>{t("common.language.label")}</strong>
                  <LanguagePicker />
                </div>
                <p className="hint">{t("onboarding.foundation.onDevice")}</p>
                <div className="welcome-actions">
                  <button className="btn btn-secondary" onClick={() => saveWelcomeStage(accountId, 0)}>
                    <ArrowLeft size={16} />
                    {t("common_back")}
                  </button>
                  <button className="btn btn-primary" onClick={next}>
                    {t("common_continue")}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            )}
            {stage === 2 && (
              <div className="welcome-form">
                <div className="welcome-destinations">
                  <button className="btn btn-secondary" onClick={() => finish("dms")}>
                    <MessagesSquare size={20} />
                    {t("nav_messages")}
                  </button>
                  <button className="btn btn-secondary" onClick={() => finish("discover")}>
                    <Compass size={20} />
                    {t("workspace.rail_discover")}
                  </button>
                </div>
                <div className="welcome-actions">
                  <button className="btn btn-secondary" onClick={() => saveWelcomeStage(accountId, 1)}>
                    <ArrowLeft size={16} />
                    {t("common_back")}
                  </button>
                  <button className="btn btn-primary" onClick={() => finish("home")}>
                    {t("onboarding.foundation.finish")}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
