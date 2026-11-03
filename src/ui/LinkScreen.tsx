import { useLocaleRender } from "../i18n/Localized";
import { text as uiText } from "../i18n";
import { Localized } from "../i18n/Localized";
import { useT as useLocalization } from "../i18n";
import { apiBase, serverHost } from "../application/config";
import { ArrowLeft, Check, Copy, KeyRound, Laptop, Lock, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClient, ApiError } from "../api/client";
import { type SessionGrant, zServerInfo } from "../api/schemas";
import { fingerprint } from "../crypto/identity";
import type { DeviceRecord } from "../model/types";
import { browserDeviceName, LinkError, type PendingLink, pollLink, startLink } from "../sync/session";
import { BrandMark } from "./components/BrandMark";
const POLL_MS = 2000;
type Phase =
  | {
      k: "starting";
    }
  | {
      k: "waiting";
      link: PendingLink;
      deviceFp: string;
    }
  | {
      k: "finishing";
    }
  | {
      k: "expired";
    }
  | {
      k: "error";
      message: string;
    };
/**
 * Linking this browser to an Orbit account: the browser makes its own keys and a one-time code; the phone approves the code
 * in Settings › Devices and hands over the account identity, sealed to this browser. No password exists anywhere.
 */
export function LinkScreen({ onLinked, onBack }: { onLinked: (device: DeviceRecord, grant: SessionGrant) => void; onBack?: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [phase, setPhase] = useState<Phase>({ k: "starting" });
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const gen = useRef(0);
  const begin = useCallback(async () => {
    const mine = ++gen.current;
    setPhase({ k: "starting" });
    try {
      // Reachable and a Meldiq server, before asking it for a link code.
      await new ApiClient(apiBase()).json("GET", "/v1/server-info", zServerInfo, { auth: false });
      if (mine !== gen.current) return;
      const link = await startLink(apiBase(), browserDeviceName());
      if (mine !== gen.current) return;
      setPhase({ k: "waiting", link, deviceFp: await fingerprint(link.keys.signingPublic) });
    } catch (e) {
      if (mine !== gen.current) return;
      setPhase({
        k: "error",
        message:
          e instanceof ApiError && e.isNetwork
            ? uiText("workspace.interface.can_t_reach_the_meldiq_server_at_value0_a929df5", { value0: serverHost() })
            : e instanceof ApiError
              ? e.message
              : uiText("workspace.interface.couldn_t_start_linking_8513a36"),
      });
    }
  }, []);
  useEffect(() => {
    const generation = gen;
    void begin();
    return () => {
      generation.current++; // abandons a link request still being made
    };
  }, [begin]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (phase.k !== "waiting") return;
    const mine = gen.current;
    let stopped = false;
    const tick = async () => {
      if (stopped || mine !== gen.current) return;
      try {
        const r = await pollLink(apiBase(), phase.link);
        if (stopped || mine !== gen.current) return;
        if (r.status === "expired") return setPhase({ k: "expired" });
        if (r.status === "linked") {
          setPhase({ k: "finishing" });
          onLinked(r.device, r.grant);
          return;
        }
      } catch (e) {
        if (e instanceof LinkError) return setPhase({ k: "error", message: e.message });
        // network hiccup: keep polling
      }
      timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [phase, onLinked]);
  const left = phase.k === "waiting" ? Math.max(0, Math.round((phase.link.expiresAt - now) / 1000)) : 0;
  const code = phase.k === "waiting" ? `${phase.link.code.slice(0, 5)} ${phase.link.code.slice(5)}` : "";
  return (
    <div className="link-screen">
      <section className="link-hero" aria-label={uiText("workspace.interface.about_meldiq_web_461f0d9")}>
        <div className="row" style={{ gap: 12 }}>
          <BrandMark size={52} />
          <div>
            <strong style={{ fontSize: 17 }}>Meldiq</strong>
            <div className="brand-byline">
              <Localized k="workspace.interface.by_griipbuddy_4c9dc95" />
            </div>
          </div>
        </div>
        <div>
          <h1>
            {l10n("auth.hero_title_1")} <em>{l10n("auth.hero_title_2")}</em>
          </h1>
          <p>{l10n("auth.hero_body")}</p>
        </div>
        <div className="hero-points">
          <div>
            <Lock size={18} />
            <span>
              <Localized k="workspace.interface.your_chats_are_stored_safely_on_meldiq_s_servers_and_sent_over_en_b06fe37" />
            </span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>
              <Localized k="workspace.interface.no_password_this_browser_gets_its_own_keys_approved_by_your_phone_aa09ff9" />
            </span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>
              <Localized k="workspace.interface.remove_this_browser_from_your_phone_at_any_time_it_signs_out_at_o_4a90ae6" />
            </span>
          </div>
        </div>
      </section>

      <main className="link-main">
        <div className="link-card card">
          {onBack && (
            <button type="button" className="btn btn-ghost btn-sm auth-back" onClick={onBack}>
              <Localized k="workspace.interface.sign_in_with_email_instead_0e55f3b" slots={[<ArrowLeft size={14} />]} />
            </button>
          )}
          <div>
            <h2>
              <Localized k="workspace.interface.link_this_browser_to_your_account_bb3256f" />
            </h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              <Localized k="workspace.interface.you_need_meldiq_on_your_phone_signed_in_to_this_server_60aaf3b" />
            </p>
          </div>

          {phase.k === "error" && (
            <div className="banner danger" role="alert">
              <span className="grow">{phase.message}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => void begin()}>
                <RefreshCw size={14} /> {l10n("common.actions.retry")}
              </button>
            </div>
          )}

          <ol className="steps">
            <li>
              <div>
                <strong>{l10n("onboarding.phone_step_open")}</strong>
                <div className="muted">
                  <Localized
                    k="workspace.interface.go_to_and_tap_8d52bd5"
                    slots={[
                      <b>
                        <Localized k="workspace.interface.settings_devices_908887a" />
                      </b>,
                      <b>
                        <Localized k="workspace.interface.approve_new_device_6bbe0a0" />
                      </b>,
                    ]}
                  />
                </div>
              </div>
            </li>
            <li>
              <div style={{ display: "grid", gap: 10 }}>
                <strong>
                  <Localized k="workspace.interface.enter_this_link_code_b5d78e2" />
                </strong>
                {phase.k === "waiting" ? (
                  <div className="code-box">
                    <span className="code" aria-label={uiText("workspace.interface.link_code_value0_dc5cdc8", { value0: phase.link.code.split("").join(" ") })}>
                      {code}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        void navigator.clipboard?.writeText(phase.link.code).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        });
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? l10n("common.common_copied") : l10n("common.actions.copy")}
                    </button>
                  </div>
                ) : phase.k === "expired" ? (
                  <div className="banner warn">
                    <span className="grow">{l10n("onboarding.phone_expired")}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => void begin()}>
                      {l10n("onboarding.phone_new_code")}
                    </button>
                  </div>
                ) : (
                  <div className="code-box" aria-busy="true">
                    <span className="skeleton" style={{ width: 220, height: 30 }} />
                  </div>
                )}
                {phase.k === "waiting" && (
                  <span className="faint" style={{ fontSize: 12.5 }} aria-live="polite">
                    <Localized k="workspace.interface.expires_in_fa8c37c" slots={[Math.floor(left / 60), String(left % 60).padStart(2, "0")]} />
                    <button className="btn-ghost" style={{ textDecoration: "underline", fontSize: 12.5 }} onClick={() => void begin()}>
                      <Localized k="workspace.interface.new_code_d7bc32e" />
                    </button>
                  </span>
                )}
              </div>
            </li>
            <li>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>{l10n("onboarding.phone_step_check")}</strong>
                <span className="muted">{l10n("onboarding.phone_step_check_sub")}</span>
                <span className="fingerprint" aria-label={uiText("workspace.interface.device_key_ac05e8b")}>
                  {phase.k === "waiting" ? phase.deviceFp : "····· ····· ····· ····· ····· ·····"}
                </span>
              </div>
            </li>
          </ol>

          <div className="banner info" aria-live="polite">
            {phase.k === "finishing" ? <Check size={16} /> : <Smartphone size={16} />}
            <span className="grow">
              {phase.k === "finishing" ? l10n("onboarding.phone_finishing") : phase.k === "waiting" ? l10n("onboarding.phone_waiting") : uiText("workspace.interface.preparing_a_link_code_0504dd4")}
            </span>
          </div>

          <div className="link-meta">
            <span className="row" style={{ gap: 6 }}>
              <Laptop size={14} /> {browserDeviceName()}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
