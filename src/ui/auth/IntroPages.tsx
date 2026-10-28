import { useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "../components/BrandMark";
import { MeldlingArt, type MeldlingPose } from "../components/MeldlingArt";
import { type StringKey, useT } from "../../i18n";
import { LanguagePicker } from "../components/LanguagePicker";

interface Page {
  /** Meldling's picture for the page (the owner's mascot set, 2026-10-29). */
  pose: MeldlingPose;
  title: StringKey;
  body: StringKey;
  /** Planned, not in the app yet: the page says so. */
  soon?: boolean;
}

/** The phone's introduction pages (android IntroScreen), in the browser's words. Communities replaced the connector and HR pages on Android (2026-10-21). */
const PAGES: Page[] = [
  { pose: "waving", title: "intro_1_title", body: "intro_1_body" },
  { pose: "love", title: "intro_2_title", body: "intro_2_body" },
  { pose: "gaming", title: "intro_3_title", body: "intro_3_body" },
  { pose: "hello", title: "intro_4_title", body: "intro_4_body" },
  { pose: "all-set", title: "intro_5_title", body: "intro_5_body" },
];

const SEEN_KEY = "meldiq.introSeen";

/** Whether this browser showed the introduction already (a per-browser convenience; never required). */
export function introSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: don't show it on every visit
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: nothing to remember */
  }
}

/**
 * The first-run introduction (android IntroScreen): a few short pages on what Meldiq does, before signing in. Skip is
 * always there and nothing asks for a permission. Shown once per browser; Settings › About shows it again.
 */
export function IntroPages({ onDone }: { onDone: () => void }) {
  const [at, setAt] = useState(0);
  const t = useT();
  const page = PAGES[at];
  const last = at === PAGES.length - 1;
  const done = () => {
    markSeen();
    onDone();
  };
  return createPortal(
    <div className="intro" role="dialog" aria-modal="true" aria-label={t("intro_label")}>
      {/* Wide screens: Meldling and this page's picture on the brand's ground, the words and buttons beside it. */}
      <aside className="intro-visual" aria-hidden="true">
        <MeldlingArt pose={page.pose} size={360} />
      </aside>
      <div className="intro-main">
        <header className="intro-head">
          <BrandMark size={32} />
          <span className="grow" />
          {/* The language can be chosen before anything else (2026-10-23). */}
          <LanguagePicker />
          <button className="btn btn-ghost btn-sm" onClick={done}>
            {t("intro_skip")}
          </button>
        </header>
        <section className="intro-page" aria-live="polite" aria-label={t("intro_page", { n: at + 1, total: PAGES.length })}>
          <span className="intro-art" aria-hidden="true">
            <MeldlingArt pose={page.pose} size={200} />
          </span>
          {page.soon && <span className="tag">Coming soon</span>}
          <h1>{t(page.title)}</h1>
          <p>{t(page.body)}</p>
        </section>
        <div className="intro-dots" aria-hidden="true">
          {PAGES.map((p, i) => (
            <span key={p.title} className={i === at ? "on" : ""} />
          ))}
        </div>
        <footer className="intro-foot">
          {at > 0 && (
            <button className="btn btn-secondary btn-lg" onClick={() => setAt(at - 1)}>
              {t("common_back")}
            </button>
          )}
          <button className="btn btn-primary btn-lg grow" onClick={() => (last ? done() : setAt(at + 1))} autoFocus>
            {last ? t("intro_start") : t("intro_next")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
