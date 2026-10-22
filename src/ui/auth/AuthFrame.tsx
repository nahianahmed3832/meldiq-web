import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";

/** The signed-out layout: Orbit's story on the left, the current step on the right (stacked on phones). */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="link-screen">
      <section className="link-hero" aria-label="About Meldiq Web">
        <div className="row" style={{ gap: 12 }}>
          <BrandMark size={52} />
          <div>
            <strong style={{ fontSize: 17 }}>Meldiq</strong>
            <div className="brand-byline">by GriipBuddy</div>
          </div>
        </div>
        <div>
          <h1>
            Your people, <em>on every screen.</em>
          </h1>
          <p>Meldiq Web is another device of your Meldiq account. Messages stay end-to-end encrypted, and your phone and this computer stay in sync through your Meldiq server.</p>
        </div>
        <div className="hero-points">
          <div>
            <Lock size={18} />
            <span>Messages are encrypted on your devices. The server only relays ciphertext.</span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>Your password signs you in. Your encryption keys leave your devices only locked with your password.</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Remove this browser from any of your devices at any time; it signs out at once.</span>
          </div>
        </div>
      </section>
      <main className="link-main">
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
