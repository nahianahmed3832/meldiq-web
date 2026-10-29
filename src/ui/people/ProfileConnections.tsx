import { isHttps, ITEMS_HEADING, PROVIDER_LABEL, type ProfileConnection, visibleConnections } from "../../sync/linkedAccounts";
import { SafeLink } from "../chat/SafeLink";

/**
 * The linked accounts on someone's profile (API 0.65.0 batch B): the provider, their name there linking to their page,
 * and the short list the server keeps (games, anime, artists or shows). Links open through SafeLink like any other.
 */
export function ProfileConnections({ list }: { list: ProfileConnection[] }) {
  const shown = visibleConnections(list);
  if (shown.length === 0) return null;
  return (
    <section className="profile-box" aria-label="Connections">
      <h3>Connections</h3>
      <ul className="profile-connections">
        {shown.map((c) => (
          <li key={c.provider}>
            <span className="profile-connection-head">
              <span className={`connection-mark cm-${c.provider}`} aria-hidden="true">
                {PROVIDER_LABEL[c.provider].slice(0, 1)}
              </span>
              <span className="faint">{PROVIDER_LABEL[c.provider]}</span>
              <SafeLink href={c.url}>{c.name}</SafeLink>
            </span>
            {c.items.length > 0 && (
              <>
                <small className="faint">{ITEMS_HEADING[c.itemsKind] ?? "Lately"}</small>
                <ul className="profile-connection-items">
                  {c.items.slice(0, 5).map((it, i) => (
                    <li key={`${it.title}-${i}`} className="ellipsis">
                      {isHttps(it.url) ? <SafeLink href={it.url}>{it.title}</SafeLink> : it.title}
                      {it.subtitle && <span className="faint"> · {it.subtitle}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
