import { Compass, Headphones, Link2, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT } from "../../i18n";

/**
 * The signed-out layout (continuation brief v3 §5): on wide screens a community-first hero, Meldling, what Meldiq is
 * for and an illustration of a community, beside a comfortably sized form; on phones a compact branded header above
 * the form. Nothing in it is invented: no member counts, activity or testimonials.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="link-screen">
      <section className="link-hero" aria-label={t("hero_about")}>
        <div className="hero-brand">
          <BrandMark size={44} />
          <div>
            <strong>Meldiq</strong>
            <div className="brand-byline">by GriipBuddy</div>
          </div>
        </div>
        <div className="hero-copy">
          <h1>
            {t("hero_c_title_1")} <em>{t("hero_c_title_2")}</em>
          </h1>
          <p>{t("hero_c_body")}</p>
          <ul className="hero-points">
            <li>
              <Link2 size={18} aria-hidden="true" />
              <span>{t("hero_c_join")}</span>
            </li>
            <li>
              <Compass size={18} aria-hidden="true" />
              <span>{t("hero_c_discover")}</span>
            </li>
            <li>
              <Headphones size={18} aria-hidden="true" />
              <span>{t("hero_c_talk")}</span>
            </li>
            <li>
              <Sparkles size={18} aria-hidden="true" />
              <span>{t("hero_c_create")}</span>
            </li>
          </ul>
        </div>
        <HeroPreview label={t("hero_c_preview")} />
        <p className="hero-foot">
          <Lock size={14} aria-hidden="true" /> {t("hero_point_encrypted")}
        </p>
      </section>
      <main className="link-main">
        {/* Picked before signing in or up, so every step is in the person's language (2026-10-23). */}
        <LanguagePicker className="auth-lang" />
        <div className="link-card card">{children}</div>
      </main>
    </div>
  );
}

/** An illustration of a community (shapes and channel names only), so the page shows what Meldiq looks like. */
function HeroPreview({ label }: { label: string }) {
  return (
    <figure className="hero-preview" aria-label={label}>
      <div className="hero-preview-rail" aria-hidden="true">
        <img src="/meldling-96.webp" alt="" width={34} height={34} />
        <i style={{ background: "linear-gradient(135deg, #22d3ee, #6366f1)" }} />
        <i style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }} />
        <i style={{ background: "linear-gradient(135deg, #22c55e, #14b8a6)" }} />
      </div>
      <div className="hero-preview-panel" aria-hidden="true">
        <div className="hero-preview-banner" />
        <span className="hero-preview-cat">Text channels</span>
        <span className="hero-preview-ch on"># welcome</span>
        <span className="hero-preview-ch"># general</span>
        <span className="hero-preview-ch"># clips</span>
        <span className="hero-preview-cat">Voice</span>
        <span className="hero-preview-ch">🔊 Lounge</span>
      </div>
    </figure>
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
