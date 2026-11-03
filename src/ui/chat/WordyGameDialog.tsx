import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Delete } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEngine } from "../../application/orbit";
import { WORDY_LENGTH, type WordyMark, wordyGuessProblem, wordyKeys, wordyMarks } from "../../sync/officialBotRules";
import { officialBotError } from "../../sync/officialBots";
import { type WordyGame, wordyGame, wordyGuess } from "../../sync/officialBotTools";
import { Dialog } from "../components/Overlay";
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;
interface WordyGameDialogProps {
  orgId: string;
  /** A guess sent with `/wordy <guess>`, made once the game loads. */
  firstGuess: string | null;
  onClose: () => void;
}
/**
 * Wordy, played privately (community parity D part 2): today's board with the player's own letters (the channel only
 * ever sees squares), an on-screen keyboard coloured by what's known, and their stats. Guesses go to the server, which
 * scores them; a word that isn't in the list doesn't use a try.
 */
export function WordyGameDialog({ orgId, firstGuess, onClose }: WordyGameDialogProps) {
  useLocaleRender();
  const engine = useEngine();
  const [game, setGame] = useState<WordyGame | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(firstGuess);
  const send = useCallback(
    async (guess: string) => {
      const problem = wordyGuessProblem(guess);
      if (problem) return setError(problem);
      setBusy(true);
      setError(null);
      try {
        setGame(await wordyGuess(engine, orgId, guess.trim().toLowerCase()));
        setTyped("");
      } catch (e) {
        setError(officialBotError(e));
      } finally {
        setBusy(false);
      }
    },
    [engine, orgId],
  );
  useEffect(() => {
    let live = true;
    wordyGame(engine, orgId)
      .then((g) => {
        if (!live) return;
        setGame(g);
        const guess = first.current;
        first.current = null;
        if (guess && !g.finished) void send(guess);
      })
      .catch((e: unknown) => live && setError(officialBotError(e)));
    return () => {
      live = false;
    };
  }, [engine, orgId, send]);
  const done = !game || game.finished || busy;
  const press = useCallback(
    (key: string) => {
      if (done) return;
      if (key === "enter") return void send(typed);
      if (key === "back") return setTyped((t) => t.slice(0, -1));
      if (/^[a-z]$/.test(key)) setTyped((t) => (t.length < WORDY_LENGTH ? t + key : t));
    },
    [done, send, typed],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Enter on a focused key or button is that button's click.
      if (e.key === "Enter" && (e.target as HTMLElement | null)?.tagName === "BUTTON") return;
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [press]);
  const keys = wordyKeys(game?.rows ?? []);
  const rows = Array.from({ length: game?.maxTries ?? 6 }, (_, i) => {
    const row = game?.rows[i];
    if (row) return { letters: row.guess.toUpperCase().padEnd(WORDY_LENGTH), marks: wordyMarks(row.marks) };
    const current = i === (game?.rows.length ?? 0) && !game?.finished;
    return { letters: (current ? typed.toUpperCase() : "").padEnd(WORDY_LENGTH), marks: [] as WordyMark[] };
  });
  return (
    <Dialog
      title={uiText("messaging.interface.wordy_35185b9")}
      subtitle={game ? uiText("messaging.interface.wordy_value0_value1_423bdf8", { value0: game.number, value1: game.day }) : uiText("messaging.interface.today_s_word_fffad11")}
      onClose={onClose}
      className="wordy-dialog"
    >
      <div className="wordy">
        <div className="wordy-grid" role="grid" aria-label={uiText("messaging.interface.your_board_98a1b57")}>
          {rows.map((r, i) => (
            <div key={i} className="wordy-row" role="row">
              {[...r.letters].map((ch, j) => (
                <span
                  key={j}
                  role="gridcell"
                  className={`wordy-tile${r.marks[j] ? ` ${r.marks[j]}` : ""}${ch.trim() ? " filled" : ""}`}
                  aria-label={
                    ch.trim()
                      ? uiText("messaging.interface.value0_value1_82032eb", { value0: ch, value1: r.marks[j] ? `, ${MARK_WORDS[r.marks[j]]}` : "" })
                      : uiText("messaging.interface.empty_2e1cfa8")
                  }
                >
                  {ch.trim()}
                </span>
              ))}
            </div>
          ))}
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {game?.finished && (
          <p className="wordy-result" role="status">
            <Localized
              k="messaging.interface.a_new_word_comes_at_00_00_utc_77c307c"
              slots={[game.solved ? uiText("messaging.interface.solved_in_value0_1cbcfd9", { value0: game.rows.length }) : uiText("messaging.interface.not_this_time_d240549")]}
            />
          </p>
        )}
        {!game?.finished && (
          <div className="wordy-keys" aria-label={uiText("messaging.interface.keyboard_2316810")}>
            {KEY_ROWS.map((row, i) => (
              <div key={row} className="wordy-key-row">
                {i === 2 && (
                  <button type="button" className="wordy-key wide" disabled={done} onClick={() => press("enter")}>
                    <Localized k="messaging.interface.enter_dc8659d" />
                  </button>
                )}
                {[...row].map((k) => (
                  <button key={k} type="button" className={`wordy-key${keys[k] ? ` ${keys[k]}` : ""}`} disabled={done} onClick={() => press(k)}>
                    {k.toUpperCase()}
                  </button>
                ))}
                {i === 2 && (
                  <button type="button" className="wordy-key wide" disabled={done} aria-label={uiText("messaging.interface.delete_a_letter_84d3d6f")} onClick={() => press("back")}>
                    <Delete size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {game && <WordyStats stats={game.stats} bars={game.finished} />}
      </div>
    </Dialog>
  );
}
const MARK_WORDS: Record<WordyMark, string> = {
  get right() {
    return uiText("messaging.interface.right_place_bb9a9b4");
  },
  get close() {
    return uiText("messaging.interface.in_the_word_elsewhere_5dc4dbd");
  },
  get absent() {
    return uiText("messaging.interface.not_in_the_word_0fdbe0b");
  },
};
/** The player's numbers; the wins-by-tries bars once today's game is over (the keyboard has the room before). */
function WordyStats({ stats, bars }: { stats: WordyGame["stats"]; bars: boolean }) {
  useLocaleRender();
  const most = Math.max(1, ...stats.distribution);
  return (
    <section className="wordy-stats" aria-label={uiText("messaging.interface.your_stats_1ea9b92")}>
      <div className="wordy-numbers">
        <span>
          <Localized k="messaging.interface.played_87123a9" slots={[<strong>{formatUiNumber(stats.played)}</strong>]} />
        </span>
        <span>
          <Localized k="messaging.interface.won_4e2496b" slots={[<strong>{formatUiNumber(stats.played ? Math.round((stats.won / stats.played) * 100) : 0)}%</strong>]} />
        </span>
        <span>
          <Localized k="messaging.interface.streak_b16dab7" slots={[<strong>{formatUiNumber(stats.streak)}</strong>]} />
        </span>
        <span>
          <Localized k="messaging.interface.best_019ff57" slots={[<strong>{formatUiNumber(stats.bestStreak)}</strong>]} />
        </span>
      </div>
      {bars && (
        <ol className="wordy-bars" aria-label={uiText("messaging.interface.wins_by_tries_10e1f97")}>
          {stats.distribution.map((n, i) => (
            <li key={i}>
              <span>{formatUiNumber(i + 1)}</span>
              <span className="wordy-bar" style={{ width: `${Math.max(8, (n / most) * 100)}%` }}>
                {formatUiNumber(n)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
