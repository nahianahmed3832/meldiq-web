import { Blocks, Bell, Headphones, IdCard, MessagesSquare } from "lucide-react";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "../components/BrandMark";

interface Page {
  icon: ReactNode;
  title: string;
  body: string;
  /** Planned, not in the app yet: the page says so. */
  soon?: boolean;
}

/** The phone's introduction pages (android IntroScreen), in the browser's words. */
const PAGES: Page[] = [
  {
    icon: <MessagesSquare size={52} />,
    title: "Work together in one place",
    body: "Channels, groups and direct messages with threads, polls and files. Everything is end-to-end encrypted on your devices.",
  },
  { icon: <Bell size={52} />, title: "Never lose track", body: "Save messages for later and set reminders. They reach every device you're signed in on, even after a restart." },
  { icon: <Headphones size={52} />, title: "Talk it through", body: "Voice and video calls with screen sharing, and voice rooms your team can drop into any time." },
  { icon: <Blocks size={52} />, title: "Bring your tools", body: "Connect Figma, GitHub, GitLab and more to your workspace, with permissions your admins control." },
  { icon: <IdCard size={52} />, title: "People and HR", body: "Team directory, attendance, shifts and leave are coming to Meldiq workspaces, with access based on roles.", soon: true },
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
  const page = PAGES[at];
  const last = at === PAGES.length - 1;
  const done = () => {
    markSeen();
    onDone();
  };
  return createPortal(
    <div className="intro" role="dialog" aria-modal="true" aria-label="Introduction to Meldiq">
      <header className="intro-head">
        <BrandMark size={32} />
        <button className="btn btn-ghost btn-sm" onClick={done}>
          Skip
        </button>
      </header>
      <section className="intro-page" aria-live="polite" aria-label={`Page ${at + 1} of ${PAGES.length}`}>
        <span className="intro-art" aria-hidden="true">
          {page.icon}
        </span>
        {page.soon && <span className="tag">Coming soon</span>}
        <h1>{page.title}</h1>
        <p>{page.body}</p>
      </section>
      <div className="intro-dots" aria-hidden="true">
        {PAGES.map((p, i) => (
          <span key={p.title} className={i === at ? "on" : ""} />
        ))}
      </div>
      <footer className="intro-foot">
        {at > 0 && (
          <button className="btn btn-secondary btn-lg" onClick={() => setAt(at - 1)}>
            Back
          </button>
        )}
        <button className="btn btn-primary btn-lg grow" onClick={() => (last ? done() : setAt(at + 1))} autoFocus>
          {last ? "Get started" : "Next"}
        </button>
      </footer>
    </div>,
    document.body,
  );
}
