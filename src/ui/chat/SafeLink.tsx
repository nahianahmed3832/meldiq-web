import { Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { getPrefs, setPrefs } from "../../application/prefs";
import { linkWarning, readableDomain } from "../../sync/linkRules";
import { Dialog } from "../components/Overlay";
import { useEngine } from "../../application/orbit";
import { openInApp } from "./inAppLinks";

/**
 * A web link from a message (android LinkOpener): opens in a new tab, never with this page as its opener or referrer.
 * A link that looks misleading (android LinkRules.warning) asks first, showing where it really goes; with Links › Ask
 * every time (android LinkOpening.ASK) every link does.
 */
export function SafeLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  /** null: not asking; "": asking because of the setting; otherwise the warning. */
  const [asking, setAsking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const engine = useEngine();
  const close = () => {
    setAsking(null);
    setCopied(false);
  };
  return (
    <>
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => {
          if (openInApp(engine, href)) return e.preventDefault();
          const warning = linkWarning(href);
          // A trusted site (Settings › Advanced) opens without asking, unless the link looks misleading.
          if (!warning && (!getPrefs().askBeforeLinks || getPrefs().trustedSites.includes(hostOf(href)))) return;
          e.preventDefault();
          setAsking(warning ?? "");
        }}
      >
        {children}
      </a>
      {asking !== null && (
        <Dialog
          title={readableDomain(href) ?? "Open link"}
          onClose={close}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(href).then(() => setCopied(true));
                }}
              >
                <Copy size={15} /> {copied ? "Copied" : "Copy link"}
              </button>
              {!asking && hostOf(href) && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setPrefs({ trustedSites: [...getPrefs().trustedSites.filter((h) => h !== hostOf(href)), hostOf(href)] });
                    window.open(href, "_blank", "noopener,noreferrer");
                    close();
                  }}
                >
                  Always trust {hostOf(href)}
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => {
                  window.open(href, "_blank", "noopener,noreferrer");
                  close();
                }}
              >
                <ExternalLink size={15} /> {asking ? "Open anyway" : "Open"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <code className="link-full">{href}</code>
            {asking ? (
              <div className="banner warn" role="alert">
                <TriangleAlert size={16} />
                <span className="grow">{asking}</span>
              </div>
            ) : (
              <p className="faint" style={{ margin: 0 }}>
                This is where the link goes. It opens in a new tab.
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}

/** The host a link goes to, in lower case ("" when it isn't a web address). */
function hostOf(href: string): string {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return "";
  }
}
