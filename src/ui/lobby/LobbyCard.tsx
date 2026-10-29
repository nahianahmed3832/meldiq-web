import { GripVertical } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import type { LobbySectionKey } from "../../api/lobbySchemas";
import { navigate } from "../../application/router";
import { cardState } from "../../sync/lobbyDraft";
import { AboutCard, FaqCard, FeedCard, GiveawaysCard, LinksCard } from "./cardsInfo";
import { LiveNowCard, MainChannelsCard, RulesCard } from "./cardsChannels";
import { LeaderboardCard, WhoRunsItCard } from "./cardsPeople";
import { PickRolesCard } from "./PickRolesCard";
import { type CardAction, SECTION_INFO } from "./lobbyInfo";
import { useLobby } from "./lobbyContext";

const BODIES: Record<LobbySectionKey, () => ReactNode> = {
  about: () => <AboutCard />,
  main_channels: () => <MainChannelsCard />,
  live_now: () => <LiveNowCard />,
  giveaways: () => <GiveawaysCard />,
  feed: () => <FeedCard />,
  faq: () => <FaqCard />,
  leaderboard: () => <LeaderboardCard />,
  pick_roles: () => <PickRolesCard />,
  rules: () => <RulesCard />,
  who_runs_it: () => <WhoRunsItCard />,
  links: () => <LinksCard />,
};

/**
 * One of the lobby's cards. Members only see cards with something in them; while editing, every shown card is there
 * (empty ones with what they're for and a button to fill them), can be dragged to move it, and opens its editor on click.
 */
export function LobbyCard({ sectionKey }: { sectionKey: LobbySectionKey }) {
  const { view, editor, editing } = useLobby();
  const state = cardState(sectionKey, view);
  if (!editing && state !== "ok") return null;
  const info = SECTION_INFO[sectionKey];
  const column = view.settings.sections.find((s) => s.key === sectionKey)?.column ?? "main";
  return (
    <EditableCard id={sectionKey} label={info.label} column={column} chip={state === "ok" ? null : state === "empty" ? "Empty" : "Nothing yet"}>
      {state === "ok" ? <div className="lobby-card-content">{BODIES[sectionKey]()}</div> : <EmptyBody sectionKey={sectionKey} onAction={editor ? (a) => act(a, sectionKey, editor) : null} />}
    </EditableCard>
  );
}

function act(a: CardAction, key: LobbySectionKey, editor: NonNullable<ReturnType<typeof useLobby>["editor"]>) {
  if (a.kind === "page") return navigate({ section: "workspace", workspacePage: a.page });
  if (a.kind === "feed") editor.setTab("sections");
  editor.select(key);
}

function EmptyBody({ sectionKey, onAction }: { sectionKey: LobbySectionKey; onAction: ((a: CardAction) => void) | null }) {
  const info = SECTION_INFO[sectionKey];
  return (
    <div className="lobby-empty">
      <p>{info.empty}</p>
      {info.cta && info.action && onAction && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onAction(info.action!);
          }}
        >
          {info.cta}
        </button>
      )}
    </div>
  );
}

interface EditableCardProps {
  id: LobbySectionKey | "top";
  label: string;
  column: "main" | "side";
  chip: string | null;
  /** The card's own title is left out (the top of the page has none). */
  untitled?: boolean;
  children: ReactNode;
}

/** A card's frame: while editing, a drag handle, its status chip, and a click that opens its editor. */
export function EditableCard({ id, label, column, chip, untitled, children }: EditableCardProps) {
  const { editor, editing } = useLobby();
  const selected = editing && editor?.selected === id;
  const open = () => editor?.select(id);
  const onKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      open();
    }
  };
  return (
    <section
      className={`lobby-card lobby-card-${id}${editing ? " editable" : ""}${selected ? " selected" : ""}`}
      aria-label={label}
      data-drag={editing && id !== "top" ? id : undefined}
      data-drag-kind="lobby-card"
      data-drag-group={column}
      onClick={editing ? open : undefined}
      onKeyDown={editing ? onKey : undefined}
      tabIndex={editing ? 0 : undefined}
      aria-pressed={editing ? selected : undefined}
    >
      {(!untitled || editing) && (
        <h2 className="lobby-card-title">
          {editing && id !== "top" && <GripVertical size={15} className="lobby-grip" aria-hidden="true" />}
          <span className="grow">{label}</span>
          {editing && chip && <span className="lobby-chip">{chip}</span>}
        </h2>
      )}
      {children}
    </section>
  );
}
