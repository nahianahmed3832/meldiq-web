import { countLabel } from "../../../i18n/counts";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { BotTag } from "../../components/BotTag";
import { Bot, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { DirectoryBot } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { installBot } from "../../../sync/bots";
import { type BotSort, botDirectory } from "../../../sync/discovery/api";
import { BOT_CATEGORY_TEXT, BOT_CHIPS, BOT_SORTS, type BotChip, chipCategory, DISCOVERY_LIMITS } from "../../../sync/discovery/rules";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../../components/SettingsCard";
/** How long typing pauses before the search runs. */
const SEARCH_DELAY_MS = 300;
interface CommunityBotsCardProps {
  orgId: string;
  /** Ids of the bots already here (shown as Added). */
  installed: ReadonlySet<string>;
  onAdded: () => void;
}
/**
 * Bots › Community bots (community parity E, feature bot-directory; the reference's community bot browser): bots their
 * makers listed, searched by name, description or command, with the reference's category chips (Most used, All, then
 * each category) and sort (Most used, Newest, A to Z). Add puts the bot in as a member; adding by ID stays above.
 */
export function CommunityBotsCard({ orgId, installed, onAdded }: CommunityBotsCardProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<BotChip>("most_used");
  const [sort, setSort] = useState<BotSort>("most_used");
  const [extra, setExtra] = useState<{
    bots: DirectoryBot[];
    next: number | null;
  } | null>(null);
  const [rev, setRev] = useState(0);
  const add = useAction();
  const more = useAction();
  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [q]);
  const category = chipCategory(chip);
  const page = useLoad(() => botDirectory(engine, { q: query, category, sort }), [engine, query, category, sort, rev]);
  useEffect(() => setExtra(null), [page.data]);
  const bots = [...(page.data?.bots ?? []), ...(extra?.bots ?? [])];
  const next = extra ? extra.next : (page.data?.nextCursor ?? null);
  const pickChip = (c: BotChip) => {
    setChip(c);
    if (c === "most_used") setSort("most_used");
  };
  const loadMore = () =>
    next !== null &&
    void more.act(async () => {
      const p = await botDirectory(engine, { q: query, category, sort, cursor: next });
      setExtra((cur) => ({ bots: [...(cur?.bots ?? []), ...p.bots], next: p.nextCursor }));
    });
  const addBot = (b: DirectoryBot) =>
    void add.act(async () => {
      await installBot(engine, orgId, b.id);
      onAdded();
      setRev((r) => r + 1);
    });
  return (
    <Card title={uiText("organization.interface.community_bots_7645810")} sub={uiText("organization.interface.bots_made_by_people_on_meldiq_browse_what_s_listed_or_add_one_by_de57709")}>
      <div className="bot-dir-tools">
        <label className="bot-dir-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={q}
            maxLength={DISCOVERY_LIMITS.query}
            placeholder={uiText("organization.interface.search_bots_05bed5c")}
            aria-label={uiText("organization.interface.search_bots_05bed5c")}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select className="input input-sm bot-dir-sort" aria-label={uiText("organization.interface.sort_bots_717ed37")} value={sort} onChange={(e) => setSort(e.target.value as BotSort)}>
          {BOT_SORTS.map((s) => (
            <option key={s.sort} value={s.sort}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="chips bot-dir-chips" role="radiogroup" aria-label={uiText("organization.interface.category_292c06f")}>
        {BOT_CHIPS.map((c) => (
          <button key={c.chip} type="button" role="radio" aria-checked={chip === c.chip} className="chip chip-toggle" onClick={() => pickChip(c.chip)}>
            {c.label}
          </button>
        ))}
      </div>
      <ErrorLine text={page.error ?? add.error ?? more.error} />
      {!page.data && !page.error && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      {page.data && bots.length === 0 && (
        <p className="faint">{query || category ? uiText("organization.interface.no_listed_bot_matches_944736a") : uiText("organization.interface.no_bots_are_listed_yet_85c7f32")}</p>
      )}
      <ul className="ws-list bot-dir-list">
        {bots.map((b) => (
          <DirectoryRow key={b.id} bot={b} added={installed.has(b.id)} busy={add.busy} onAdd={() => addBot(b)} />
        ))}
      </ul>
      {next !== null && (
        <button className="btn btn-secondary btn-sm" disabled={more.busy} onClick={loadMore}>
          {more.busy ? l10n("common.status.loading") : l10n("workspace.discover_more")}
        </button>
      )}
    </Card>
  );
}
interface DirectoryRowProps {
  bot: DirectoryBot;
  added: boolean;
  busy: boolean;
  onAdd: () => void;
}
function DirectoryRow({ bot: b, added, busy, onAdd }: DirectoryRowProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const category = b.category === "unknown" ? null : BOT_CATEGORY_TEXT[b.category];
  return (
    <li className="ws-row bot-dir-row">
      <Bot size={20} className="faint" aria-hidden="true" />
      <span className="lines grow">
        <span className="ellipsis">
          {b.displayName} <BotTag />
          {category && <span className="chip bot-dir-cat">{category}</span>}
        </span>
        {b.description && <span className="bot-dir-desc">{b.description}</span>}
        <small className="faint">
          <Localized
            k="organization.interface.native_count_60fd84c9c"
            slots={[
              b.username,
              b.owner ? uiText("organization.interface.by_value0_7091b6d", { value0: b.owner.username }) : "",
              countLabel(b.installCount, "communities"),
              "",
              b.commands.length > 0
                ? uiText("organization.interface.native_count_3fa097aee", {
                    value0: countLabel(b.commands.length, "commands"),
                    value1: "",
                    value2: b.commands
                      .slice(0, 4)
                      .map((c) => `/${c.name}`)
                      .join(" "),
                  })
                : "",
            ]}
          />
        </small>
      </span>
      <button className="btn btn-primary btn-sm" disabled={added || busy} onClick={onAdd}>
        {added ? uiText("messaging.interface.added_6b02e0d") : l10n("common.actions.add")}
      </button>
    </li>
  );
}
