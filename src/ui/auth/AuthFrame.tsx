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
 * The signed-out page, which is also Meldiq Web's landing page (owner's brief, 2026-10-30): one dark, community and
 * gaming look in every palette, Meldling, the headline, one line, and Explore and Join; the sign-in card beside the
 * hero on wide screens and below it on phones and tablets; then what Meldiq has and its plans. Nothing in it is
 * invented: no member counts, activity or testimonials, and only features the product has.
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
          <BrandMark size={36} />
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
          <a className="btn landing-btn-explore" href={`#${EXPLORE_ID}`}>
            <ArrowDown size={18} aria-hidden="true" />
            {t("landing_explore")}
          </a>
          <button type="button" className="btn landing-btn-join" onClick={join}>
            {canJoin ? <UserPlus size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
            {canJoin ? t("landing_join") : t("landing_signin")}
          </button>
        </div>
        <HeroArt />
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
 * Meldling with a headset and a controller, sized for the screen: 280, 420 or 640 pixels wide, so phones download a
 * small file and wide screens a sharp one (never one image stretched across every size).
 */
function HeroArt() {
  return (
    <div className="landing-art" aria-hidden="true">
      <img
        src="/meldling/gaming-420.webp"
        srcSet="/meldling/gaming-280.webp 280w, /meldling/gaming-420.webp 420w, /meldling/gaming.webp 640w"
        sizes="(max-width: 599px) 140px, (max-width: 1023px) 220px, (max-width: 1679px) 240px, 340px"
        width={640}
        height={632}
        alt=""
        fetchPriority="high"
        decoding="async"
      />
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
