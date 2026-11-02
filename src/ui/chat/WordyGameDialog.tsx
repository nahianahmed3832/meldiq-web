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
    <Dialog title="Wordy" subtitle={game ? `Wordy #${game.number} · ${game.day}` : "Today's word"} onClose={onClose} className="wordy-dialog">
      <div className="wordy">
        <div className="wordy-grid" role="grid" aria-label="Your board">
          {rows.map((r, i) => (
            <div key={i} className="wordy-row" role="row">
              {[...r.letters].map((ch, j) => (
                <span
                  key={j}
                  role="gridcell"
                  className={`wordy-tile${r.marks[j] ? ` ${r.marks[j]}` : ""}${ch.trim() ? " filled" : ""}`}
                  aria-label={ch.trim() ? `${ch}${r.marks[j] ? `, ${MARK_WORDS[r.marks[j]]}` : ""}` : "empty"}
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
            {game.solved ? `Solved in ${game.rows.length}! ` : "Not this time. "}A new word comes at 00:00 UTC.
          </p>
        )}
        {!game?.finished && (
          <div className="wordy-keys" aria-label="Keyboard">
            {KEY_ROWS.map((row, i) => (
              <div key={row} className="wordy-key-row">
                {i === 2 && (
                  <button type="button" className="wordy-key wide" disabled={done} onClick={() => press("enter")}>
                    Enter
                  </button>
                )}
                {[...row].map((k) => (
                  <button key={k} type="button" className={`wordy-key${keys[k] ? ` ${keys[k]}` : ""}`} disabled={done} onClick={() => press(k)}>
                    {k.toUpperCase()}
                  </button>
                ))}
                {i === 2 && (
                  <button type="button" className="wordy-key wide" disabled={done} aria-label="Delete a letter" onClick={() => press("back")}>
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

const MARK_WORDS: Record<WordyMark, string> = { right: "right place", close: "in the word, elsewhere", absent: "not in the word" };

/** The player's numbers; the wins-by-tries bars once today's game is over (the keyboard has the room before). */
function WordyStats({ stats, bars }: { stats: WordyGame["stats"]; bars: boolean }) {
  const most = Math.max(1, ...stats.distribution);
  return (
    <section className="wordy-stats" aria-label="Your stats">
      <div className="wordy-numbers">
        <span>
          <strong>{stats.played}</strong> played
        </span>
        <span>
          <strong>{stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%</strong> won
        </span>
        <span>
          <strong>{stats.streak}</strong> streak
        </span>
        <span>
          <strong>{stats.bestStreak}</strong> best
        </span>
      </div>
      {bars && (
        <ol className="wordy-bars" aria-label="Wins by tries">
          {stats.distribution.map((n, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              <span className="wordy-bar" style={{ width: `${Math.max(8, (n / most) * 100)}%` }}>
                {n}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
