import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
 * every time (android LinkOpening.ASK) every link does. A [masked] link (its words aren't its address) always asks.
 */
export function SafeLink({ href, className, children, masked = false }: { href: string; className?: string; children: ReactNode; masked?: boolean }) {
  useLocaleRender();
  const l10n = useLocalization();
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
          // A link whose words aren't its address (a box's [text](link)) always shows where it goes first.
          const warning =
            linkWarning(href) ?? (masked ? uiText("messaging.interface.the_link_s_text_doesn_t_show_where_it_goes_it_goes_to_value0_a6b074d", { value0: readableDomain(href) ?? hostOf(href) }) : null);
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
          title={readableDomain(href) ?? uiText("messaging.interface.open_link_aab63f8")}
          onClose={close}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(href).then(() => setCopied(true));
                }}
              >
                <Copy size={15} /> {copied ? l10n("common.common_copied") : l10n("messaging.fwd_copy_link")}
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
                  <Localized k="messaging.interface.always_trust_0ef469c" slots={[hostOf(href)]} />
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => {
                  window.open(href, "_blank", "noopener,noreferrer");
                  close();
                }}
              >
                <ExternalLink size={15} /> {asking ? uiText("messaging.interface.open_anyway_91b985d") : l10n("workspace.discover_open_btn")}
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
                <Localized k="messaging.interface.this_is_where_the_link_goes_it_opens_in_a_new_tab_0173817" />
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
