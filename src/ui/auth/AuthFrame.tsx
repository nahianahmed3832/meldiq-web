import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT } from "../../i18n";

/**
 * The signed-out page, which is also Meldiq Web's homepage, in the app's own design (tokens, frame and panels; the
 * person's palette, light or dark like the app). Only three things, as the owner asked (2026-10-30: "logo, photo of
 * inside app that already have and login system that's all"): the Meldiq logo, a picture of the app's own layout, and
 * the sign-in card (which also leads to creating an account). The headline stays for screen readers and search engines
 * only. On wide screens the picture sits beside the card; on phones and tablets the card comes first.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const t = useT();
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
        <h1 id="landing-title" className="sr-only">
          Meldiq: {t("hero_c_title_1")} {t("hero_c_title_2")}
        </h1>
        <AppPreview />
      </section>

      <main className="landing-auth">
        <div className="link-card card landing-card">{children}</div>
      </main>

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
        {[62, 44, 70, 52, 38].map((w, i) => (
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
