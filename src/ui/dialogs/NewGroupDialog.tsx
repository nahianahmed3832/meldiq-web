import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, Search, UsersRound, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Member } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { searchPeople } from "../../sync/account";
import { createGroup } from "../../sync/workspaces";
import { groupAddProblem } from "../../sync/groupAdd";
import { Dialog } from "../components/Overlay";
import { UserAvatar } from "../components/OrgAvatar";
/** Groups hold up to 50 people on this server (server/src/routes/conversations.ts MAX_GROUP); people on other servers can't be added. */
const MAX_OTHERS = 49;
/** A new group conversation: a name and the people in it (android NewActions › New group); [initial] starts picked (B14 "New group with…"). */
export function NewGroupDialog({ onClose, initial = [] }: { onClose: () => void; initial?: Member[] }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [searchTick, setSearchTick] = useState(0);
  const [found, setFound] = useState<Member[]>([]);
  const [picked, setPicked] = useState<Member[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const term = q.trim();
    let alive = true;
    setFound([]);
    setSearchError(null);
    setSearching(!!term);
    if (!term) return;
    const timer = setTimeout(() => {
      searchPeople(engine, term)
        .then((r) => {
          if (alive) setFound(r.filter((m) => m.id !== engine.device.userId && !m.homeServer));
        })
        .catch((e) => {
          if (alive) setSearchError(e instanceof Error ? e.message : uiText("workspace.interface.search_failed_01ee45e"));
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, engine, searchTick]);
  const toggle = (m: Member) => setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : p.length >= MAX_OTHERS ? p : [...p, m]));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(uiText("workspace.interface.give_the_group_a_name_88d48c0"));
    if (picked.length === 0) return setError(uiText("workspace.interface.add_at_least_one_person_962e588"));
    setBusy(true);
    setError(null);
    try {
      const c = await createGroup(
        engine,
        name,
        picked.map((m) => m.id),
      );
      onClose();
      navigate({ section: "dms", conversationId: c.id });
    } catch (err) {
      // API 0.65.0: someone's choice refuses being added to groups; name them so they can be taken out.
      const refused = groupAddProblem(err, (id) => picked.find((m) => m.id === id)?.displayName);
      setError(
        refused
          ? uiText("workspace.interface.value0_take_them_out_to_make_the_group_18c2077", { value0: refused })
          : err instanceof ApiError
            ? err.message
            : uiText("workspace.interface.couldn_t_create_the_group_65522c1"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("messaging.interface.new_group_df796c6")} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="ng-name">
            <Localized k="workspace.interface.group_name_762ebb7" />
          </label>
          <input id="ng-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        {picked.length > 0 && (
          <div className="chips" aria-label={uiText("workspace.interface.people_in_the_group_deeee6a")}>
            {picked.map((m) => (
              <button type="button" key={m.id} className="chip" onClick={() => toggle(m)} aria-label={uiText("messaging.interface.remove_value0_3028bf7", { value0: m.displayName })}>
                {m.displayName} <X size={12} />
              </button>
            ))}
          </div>
        )}
        <div className="row input" style={{ padding: "0 12px" }}>
          <Search size={16} className="faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uiText("workspace.interface.add_people_by_name_or_username_324bcbc")}
            aria-label={uiText("workspace.interface.find_people_17a85d8")}
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </div>
        {searchError && (
          <div className="banner danger" role="alert">
            {searchError}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearchTick((n) => n + 1)}>
              {l10n("common.actions.retry")}
            </button>
          </div>
        )}
        {searching && <p role="status">{l10n("common.status.loading")}</p>}
        {q.trim() && !searching && !searchError && !found.length && <p role="status">{uiText("workspace.interface.nothing_found_eb1fa11")}</p>}
        <div aria-label={uiText("workspace.interface.people_found_29b8414")} style={{ display: "grid", gap: 2, maxHeight: 240, overflow: "auto" }}>
          {found.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <button type="button" key={p.id} className="list-row" aria-pressed={on} onClick={() => toggle(p)}>
                <UserAvatar userId={p.id} name={p.displayName} colorIndex={p.avatarColor} photoRev={p.photoRev} size={32} decorative />
                <span className="lines grow">
                  <span className="ellipsis">{p.displayName}</span>
                  <small>@{p.username}</small>
                </span>
                {on && <Check size={16} />}
              </button>
            );
          })}
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <UsersRound size={16} /> {busy ? l10n("auth.signup_busy") : uiText("workspace.interface.create_group_value0_f83732e", { value0: picked.length ? ` (${picked.length + 1})` : "" })}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
