import { Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { linkWarning, readableDomain } from "../../sync/linkRules";
import { Dialog } from "../components/Overlay";

/**
 * A web link from a message (android LinkOpener): opens in a new tab, never with this page as its opener or referrer.
 * A link that looks misleading (android LinkRules.warning) asks first, showing where it really goes.
 */
export function SafeLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
          const warning = linkWarning(href);
          if (!warning) return;
          e.preventDefault();
          setAsking(warning);
        }}
      >
        {children}
      </a>
      {asking && (
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
              <button
                className="btn btn-primary"
                onClick={() => {
                  window.open(href, "_blank", "noopener,noreferrer");
                  close();
                }}
              >
                <ExternalLink size={15} /> Open anyway
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <code className="link-full">{href}</code>
            <div className="banner warn" role="alert">
              <TriangleAlert size={16} />
              <span className="grow">{asking}</span>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
