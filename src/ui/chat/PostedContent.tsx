import { ExternalLink, ImageOff } from "lucide-react";
import { useState } from "react";
import type { RichContent } from "../../model/types";
import { buttonText, colorHex, type Embed, type PostButton } from "../../sync/posting/embeds";
import { readableDomain } from "../../sync/linkRules";
import { CloseTicketDialog, OpenTicketDialog } from "../community/tickets/TicketDialogs";
import { GiveawayStatus } from "./GiveawayStatus";
import { Markdown, MarkdownLine } from "./Markdown";
import { SafeLink } from "./SafeLink";

/**
 * A post's boxes and buttons (community parity C): what a webhook, "Make a post" or the Tickets sender posted. Drawn
 * from the cleaned payload (sync/posting/embeds.ts), so every link is https and every text plain React text.
 */
export function PostedContent({ rich, orgId, channelId }: { rich: RichContent; orgId: string | null; channelId: string }) {
  return (
    <>
      {rich.embeds?.map((e, i) => (
        <EmbedBox key={i} embed={e} />
      ))}
      {rich.giveaway && <GiveawayStatus giveaway={rich.giveaway} />}
      {rich.buttons?.length ? <PostButtons buttons={rich.buttons} orgId={orgId} channelId={channelId} /> : null}
    </>
  );
}

/** One box: a colour bar on the left, the author line, the title (a link when it has one), the text, pictures, footer. */
export function EmbedBox({ embed: e }: { embed: Embed }) {
  const bar = colorHex(e.color);
  return (
    <article className="embed" style={bar ? { borderInlineStartColor: bar } : undefined} aria-label={e.title ?? "Box"}>
      <div className="embed-body">
        {e.author && (
          <div className="embed-author">
            <MarkdownLine text={e.author} />
          </div>
        )}
        {e.title && (
          <div className="embed-title">
            {e.url ? (
              <SafeLink href={e.url} masked>
                <MarkdownLine text={e.title} />
              </SafeLink>
            ) : (
              <MarkdownLine text={e.title} />
            )}
          </div>
        )}
        {e.description && (
          <div className="embed-text">
            <Markdown text={e.description} />
          </div>
        )}
        {e.image && <Picture url={e.image} className="embed-image" />}
        {e.footer && <div className="embed-footer">{e.footer}</div>}
      </div>
      {e.thumbnail && <Picture url={e.thumbnail} className="embed-thumb" />}
    </article>
  );
}

/**
 * A box's picture, from the address the poster gave (https only), sent without this page as referrer. Where the
 * browser won't load pictures from other sites (Meldiq's own pages don't), a link to it shows instead.
 */
function Picture({ url, className }: { url: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <SafeLink href={url} className={`embed-picture-link ${className}-link`}>
        <ImageOff size={14} aria-hidden /> Picture · {readableDomain(url) ?? "link"}
      </SafeLink>
    );
  return <img className={className} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(true)} />;
}

type TicketDialog = { k: "open"; panelId: string | null } | { k: "close" } | null;

/** Link buttons open their address (asking first like any link); ticket buttons open or close a ticket here. */
function PostButtons({ buttons, orgId, channelId }: { buttons: PostButton[]; orgId: string | null; channelId: string }) {
  const [dialog, setDialog] = useState<TicketDialog>(null);
  return (
    <div className="post-buttons">
      {buttons.map((b, i) =>
        b.kind === "link" ? (
          <SafeLink key={i} href={b.url} className="btn btn-secondary btn-sm post-button">
            {buttonText(b)} <ExternalLink size={13} aria-hidden />
          </SafeLink>
        ) : (
          <button
            key={i}
            type="button"
            className={`btn btn-sm post-button ${b.action === "close_ticket" ? "btn-danger" : "btn-primary"}`}
            disabled={!orgId}
            onClick={() => setDialog(b.action === "open_ticket" ? { k: "open", panelId: b.panelId } : { k: "close" })}
          >
            {buttonText(b)}
          </button>
        ),
      )}
      {dialog?.k === "open" && orgId && <OpenTicketDialog orgId={orgId} panelId={dialog.panelId} onClose={() => setDialog(null)} />}
      {dialog?.k === "close" && orgId && <CloseTicketDialog orgId={orgId} channelId={channelId} onClose={() => setDialog(null)} />}
    </div>
  );
}
