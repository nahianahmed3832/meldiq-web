import { ArrowDown, LogIn, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT } from "../../i18n";
import { LandingExplore } from "./LandingExplore";

/** The form card's anchor: Join scrolls to it (phones and tablets show it below the hero). */
const JOIN_ID = "join";
const EXPLORE_ID = "explore";

interface AuthFrameProps {
  children: ReactNode;
  /** Join: opens creating an account when this server takes new ones, else signing in. */
  onJoin?: () => void;
  /** Whether Join creates an account (registration open) or only signs in. */
  canJoin?: boolean;
}

/**
 * The signed-out page, which is also Meldiq Web's landing page (owner's brief, 2026-10-30; restyled the same day: "it
 * should match the web app, its own brand design"). It is drawn with the app's own tokens, panels and buttons, so it
 * follows the person's palette and light or dark like the app does: the Meldling mark, the headline, one line, Explore
 * and Join, and a small picture of the app's floating layout; the sign-in card beside it on wide screens and below it on
 * phones and tablets; then what Meldiq has and its plans. Nothing in it is invented: no member counts, activity or
 * testimonials, and only features the product has.
 */
export function AuthFrame({ children, onJoin, canJoin = false }: AuthFrameProps) {
  const t = useT();
  const join = () => {
    onJoin?.();
    const card = document.getElementById(JOIN_ID);
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
    // After the step changes, put the cursor in the form's first field.
    requestAnimationFrame(() => card?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus({ preventScroll: true }));
  };
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <BrandMark size={34} />
          <strong>Meldiq</strong>
        </div>
        <LanguagePicker className="landing-lang" />
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <span className="landing-eyebrow">{t("landing_eyebrow")}</span>
          <h1 id="landing-title">
            {t("hero_c_title_1")} <em>{t("hero_c_title_2")}</em>
          </h1>
        </div>
        <p className="landing-line">{t("landing_line")}</p>
        <div className="landing-actions">
          <button type="button" className="btn btn-primary landing-btn" onClick={join}>
            {canJoin ? <UserPlus size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
            {canJoin ? t("landing_join") : t("landing_signin")}
          </button>
          <a className="btn btn-secondary landing-btn" href={`#${EXPLORE_ID}`}>
            <ArrowDown size={18} aria-hidden="true" />
            {t("landing_explore")}
          </a>
        </div>
        <AppPreview />
      </section>

      <main className="landing-auth" id={JOIN_ID}>
        <div className="link-card card landing-card">{children}</div>
      </main>

      <LandingExplore id={EXPLORE_ID} />

      <footer className="landing-foot">
        <span>Meldiq by GriipBuddy</span>
        <a href="https://meldiq.app/legal/terms">{t("landing_terms")}</a>
        <a href="https://meldiq.app/legal/privacy">{t("landing_privacy")}</a>
      </footer>
    </div>
  );
}

/**
 * A small picture of the app as it looks signed in: the rail with Meldling and community circles, a channel list and a
 * conversation with the composer, in the app's own panels and colours. Shapes and channel names only (no invented
 * people or messages); decorative, so screen readers skip it.
 */
function AppPreview() {
  return (
    <div className="landing-preview" aria-hidden="true">
      <div className="lp-rail">
        <img src="/meldling-96.webp" alt="" width={34} height={34} />
        <span className="lp-sep" />
        <i />
        <i />
        <i />
        <span className="lp-add">+</span>
      </div>
      <div className="lp-side">
        <span className="lp-title" />
        <span className="lp-cat">Text channels</span>
        <span className="lp-ch on"># welcome</span>
        <span className="lp-ch"># general</span>
        <span className="lp-ch"># clips</span>
        <span className="lp-cat">Voice</span>
        <span className="lp-ch">🔊 Lounge</span>
      </div>
      <div className="lp-main">
        <div className="lp-head">
          <span className="lp-hash"># welcome</span>
        </div>
        {[62, 44, 70].map((w, i) => (
          <div className="lp-msg" key={i}>
            <i />
            <div>
              <span style={{ width: "28%" }} />
              <span style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
        <div className="lp-composer">
          <span />
          <b />
        </div>
      </div>
    </div>
  );
}

export function AuthHeading({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      {sub && (
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** A form-level problem, announced to screen readers. */
export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="banner danger" role="alert">
      <span className="grow">{text}</span>
    </div>
  );
}

export function FormNotice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="banner info" role="status">
      <span className="grow">{text}</span>
    </div>
  );
}

/** A quiet text button, for "Forgot password?" and the like. */
export function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="text-link" onClick={onClick}>
      {children}
    </button>
  );
}
