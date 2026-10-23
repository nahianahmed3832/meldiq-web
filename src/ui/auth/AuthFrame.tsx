import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT } from "../../i18n";

/** The signed-out layout: Orbit's story on the left, the current step on the right (stacked on phones). */
export function AuthFrame({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="link-screen">
      <section className="link-hero" aria-label={t("hero_about")}>
        <div className="row" style={{ gap: 12 }}>
          <BrandMark size={52} />
          <div>
            <strong style={{ fontSize: 17 }}>Meldiq</strong>
            <div className="brand-byline">by GriipBuddy</div>
          </div>
        </div>
        <div>
          <h1>
            {t("hero_title_1")} <em>{t("hero_title_2")}</em>
          </h1>
          <p>{t("hero_body")}</p>
        </div>
        <div className="hero-points">
          <div>
            <Lock size={18} />
            <span>{t("hero_point_encrypted")}</span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>{t("hero_point_keys")}</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>{t("hero_point_remove")}</span>
          </div>
        </div>
      </section>
      <main className="link-main">
        {/* Picked before signing in or up, so every step is in the person's language (2026-10-23). */}
        <LanguagePicker className="auth-lang" />
        <div className="link-card card">{children}</div>
      </main>
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
