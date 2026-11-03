import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Search, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { Member } from "../../api/schemas";
import { useCommunityServer, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { resolveAddress, searchPeople, startDirect } from "../../sync/account";
import { lookupKind, normalAddress } from "../../sync/lookup";
import { findByPhone } from "../../sync/profile";
import { Dialog } from "../components/Overlay";
import { UserAvatar } from "../components/OrgAvatar";
/**
 * Start a direct message: people who share a workspace with you, anyone by exact @username (server search rules), by exact
 * phone number (only people who allow it), or on another server by their full address (@name:domain, when this server
 * federates).
 */
export function NewMessageDialog({ onClose, onNewGroup }: { onClose: () => void; onNewGroup?: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const community = useCommunityServer();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const federates = useOrbit((s) => !!s.server?.federation);
  const term = q.trim();
  const kind = lookupKind(term);
  useEffect(() => {
    if (!term) return setPeople([]);
    let alive = true;
    const find = async (): Promise<Member[]> => {
      if (kind === "phone") {
        // The server only looks up international numbers: say so rather than answer "no one found".
        if (!term.startsWith("+")) throw new Error(uiText("workspace.interface.phone_numbers_start_with_and_the_country_code_for_example_44_20_7_c71d636"));
        const p = await findByPhone(engine, term);
        return p ? [p] : [];
      }
      if (kind === "address") return federates ? [await resolveAddress(engine, normalAddress(term))] : [];
      return searchPeople(engine, term);
    };
    const t = setTimeout(() => {
      find()
        .then((r) => {
          if (!alive) return;
          setPeople(r);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setPeople([]);
          setError(e instanceof Error ? e.message : uiText("workspace.interface.search_failed_01ee45e"));
        });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, kind, federates, engine]);
  const open = async (id: string) => {
    setBusy(true);
    try {
      const cid = await startDirect(engine, id);
      onClose();
      navigate({ section: "dms", conversationId: cid });
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_open_the_conversation_1f813b2"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={l10n("workspace.side_new_message")} onClose={onClose}>
      <div className="dialog-body">
        <div className="row input" style={{ padding: "0 12px" }}>
          <Search size={16} className="faint" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={federates ? uiText("workspace.interface.name_username_phone_or_name_server_b6bfa4d") : uiText("workspace.interface.name_username_or_phone_number_9e872a0")}
            aria-label={uiText("workspace.interface.find_people_17a85d8")}
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </div>
        {error && <div className="banner danger">{error}</div>}
        <div aria-label={uiText("calls.interface.people_7db2089")} style={{ display: "grid", gap: 2 }}>
          {people.map((p) => (
            <button key={p.id} className="list-row" disabled={busy} onClick={() => void open(p.id)}>
              <UserAvatar userId={p.id} name={p.displayName} colorIndex={p.avatarColor} photoRev={p.photoRev} size={34} online={p.online} decorative />
              <span className="lines">
                <span className="ellipsis">{p.displayName}</span>
                <small>@{p.username}</small>
              </span>
            </button>
          ))}
          {term && people.length === 0 && !error && (
            <p className="faint" style={{ margin: "8px 4px" }}>
              {kind === "phone"
                ? uiText("workspace.interface.no_one_found_with_that_number_people_only_appear_here_by_phone_if_c14f69f")
                : kind === "address"
                  ? federates
                    ? uiText("workspace.interface.no_one_found_at_that_address_84e3a3f")
                    : uiText("workspace.interface.this_meldiq_server_doesn_t_connect_to_other_servers_so_addresses_44e2bba")
                  : uiText("workspace.interface.no_one_found_people_appear_here_when_you_share_a_value0_or_by_the_49ed9ac", {
                      value0: community ? uiText("workspace.interface.community_f354ee9") : uiText("workspace.interface.workspace_a279fe9"),
                    })}
            </p>
          )}
          {!q.trim() && (
            <>
              <p className="faint" style={{ margin: "8px 4px" }}>
                <Localized k="workspace.interface.search_for_a_colleague_or_start_a_group_conversation_af5b9a8" />
              </p>
              {onNewGroup && (
                <button className="list-row" onClick={onNewGroup}>
                  <span className="empty-orb" style={{ width: 34, height: 34 }}>
                    <UsersRound size={16} />
                  </span>
                  <span className="lines">
                    <span>
                      <Localized k="messaging.interface.new_group_df796c6" />
                    </span>
                    <small>
                      <Localized k="workspace.interface.up_to_50_people_on_this_server_a4e62b1" />
                    </small>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
