import { ArrowLeft, Check, Copy, KeyRound, Laptop, Lock, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClient, ApiError } from "../api/client";
import { type ServerInfo, type SessionGrant, zServerInfo } from "../api/schemas";
import { fingerprint } from "../crypto/identity";
import type { DeviceRecord } from "../model/types";
import { browserDeviceName, LinkError, type PendingLink, pollLink, startLink } from "../sync/session";
import { OrbitMark } from "./components/OrbitMark";

const POLL_MS = 2000;

type Phase = { k: "starting" } | { k: "waiting"; link: PendingLink; deviceFp: string } | { k: "finishing" } | { k: "expired" } | { k: "error"; message: string };

/**
 * Linking this browser to an Orbit account: the browser makes its own keys and a one-time code; the phone approves the code
 * in Settings › Devices and hands over the account identity, sealed to this browser. No password exists anywhere.
 */
export function LinkScreen({ onLinked, onBack }: { onLinked: (device: DeviceRecord, grant: SessionGrant) => void; onBack?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ k: "starting" });
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const gen = useRef(0);

  const begin = useCallback(async () => {
    const mine = ++gen.current;
    setPhase({ k: "starting" });
    try {
      const info = await new ApiClient("").json("GET", "/v1/server-info", zServerInfo, { auth: false });
      if (mine !== gen.current) return;
      setServer(info);
      const link = await startLink("", browserDeviceName());
      if (mine !== gen.current) return;
      setPhase({ k: "waiting", link, deviceFp: await fingerprint(link.keys.signingPublic) });
    } catch (e) {
      if (mine !== gen.current) return;
      setPhase({ k: "error", message: e instanceof ApiError && e.isNetwork ? `Can't reach the Orbit server at ${location.host}.` : e instanceof ApiError ? e.message : "Couldn't start linking." });
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
        const r = await pollLink("", phase.link);
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
      <section className="link-hero" aria-label="About Orbit Web">
        <div className="row" style={{ gap: 12 }}>
          <OrbitMark size={44} />
          <div>
            <strong style={{ fontSize: 17 }}>Orbit</strong>
            <div style={{ color: "#b8aaa5", fontSize: 12.5 }}>by GriipBuddy</div>
          </div>
        </div>
        <div>
          <h1>
            Your team, <em>on every screen.</em>
          </h1>
          <p>Orbit Web is another device of your Orbit account. Messages stay end-to-end encrypted, and your phone and this computer stay in sync through your Orbit server.</p>
        </div>
        <div className="hero-points">
          <div>
            <Lock size={18} />
            <span>Messages are encrypted on your devices. The server only relays ciphertext.</span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>No password: this browser gets its own keys, approved by your phone.</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Remove this browser from your phone at any time; it signs out at once.</span>
          </div>
        </div>
      </section>

      <main className="link-main">
        <div className="link-card card">
          {onBack && (
            <button type="button" className="btn btn-ghost btn-sm auth-back" onClick={onBack}>
              <ArrowLeft size={14} /> Sign in with email instead
            </button>
          )}
          <div>
            <h2>Link this browser to your account</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              You need Orbit on your phone, signed in to this server.
            </p>
          </div>

          {phase.k === "error" && (
            <div className="banner danger" role="alert">
              <span className="grow">{phase.message}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => void begin()}>
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          )}

          <ol className="steps">
            <li>
              <div>
                <strong>On your phone, open Orbit</strong>
                <div className="muted">
                  Go to <b>Settings › Devices</b> and tap <b>Approve new device</b>.
                </div>
              </div>
            </li>
            <li>
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Enter this link code</strong>
                {phase.k === "waiting" ? (
                  <div className="code-box">
                    <span className="code" aria-label={`Link code ${phase.link.code.split("").join(" ")}`}>
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
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                ) : phase.k === "expired" ? (
                  <div className="banner warn">
                    <span className="grow">That code expired.</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => void begin()}>
                      New code
                    </button>
                  </div>
                ) : (
                  <div className="code-box" aria-busy="true">
                    <span className="skeleton" style={{ width: 220, height: 30 }} />
                  </div>
                )}
                {phase.k === "waiting" && (
                  <span className="faint" style={{ fontSize: 12.5 }} aria-live="polite">
                    Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} ·{" "}
                    <button className="btn-ghost" style={{ textDecoration: "underline", fontSize: 12.5 }} onClick={() => void begin()}>
                      new code
                    </button>
                  </span>
                )}
              </div>
            </li>
            <li>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Check the device key, then approve</strong>
                <span className="muted">Your phone shows a device key. It must match this one exactly:</span>
                <span className="fingerprint" aria-label="Device key">
                  {phase.k === "waiting" ? phase.deviceFp : "····· ····· ····· ····· ····· ·····"}
                </span>
              </div>
            </li>
          </ol>

          <div className="banner info" aria-live="polite">
            {phase.k === "finishing" ? <Check size={16} /> : <Smartphone size={16} />}
            <span className="grow">{phase.k === "finishing" ? "Approved. Setting up this browser…" : phase.k === "waiting" ? "Waiting for your phone to approve…" : "Preparing a link code…"}</span>
          </div>

          <div className="link-meta">
            <span className="row" style={{ gap: 6 }}>
              <Laptop size={14} /> {browserDeviceName()}
            </span>
            <span>
              Server: {location.host}
              {server ? ` · ${server.instanceName ?? "Orbit"} ${server.version}` : ""}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
