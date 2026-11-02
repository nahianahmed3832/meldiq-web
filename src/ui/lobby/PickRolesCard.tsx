import { Check } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { answerOnboarding, onboarding } from "../../sync/guide";
import { pickRolesAnswer, togglePick } from "../../sync/lobbyDraft";
import { useLobby } from "./lobbyContext";

/**
 * Pick your roles: the community's onboarding questions whose answers give roles. Saving sends every onboarding answer
 * (the server replaces them all), so answers to the other questions are kept as they were.
 */
export function PickRolesCard() {
  const { view } = useLobby();
  // A fresh form whenever the saved answers change (after saving, or on another device).
  return <PickRolesForm key={view.pickRoles.answered.join(",")} />;
}

function PickRolesForm() {
  const engine = useEngine();
  const { view, orgId, reload } = useLobby();
  const { prompts, answered } = view.pickRoles;
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(answered));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optionIds = prompts.flatMap((p) => p.options.map((o) => o.id));
  const dirty = optionIds.some((id) => chosen.has(id) !== answered.includes(id));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const before = await onboarding(engine, orgId);
      await answerOnboarding(engine, orgId, pickRolesAnswer(before.answered ?? [], optionIds, chosen));
      engine.notice("info", "Your roles are updated.");
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your roles. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lobby-pick">
      {prompts.map((p) => (
        <fieldset key={p.id} className="lobby-pick-q">
          <legend>{p.title}</legend>
          <div className="lobby-pick-options">
            {p.options.map((o) => {
              const on = chosen.has(o.id);
              return (
                <button key={o.id} className={`chip lobby-pick-option${on ? " on" : ""}`} aria-pressed={on} onClick={() => setChosen((c) => togglePick(c, p, o.id))}>
                  {on && <Check size={13} aria-hidden="true" />}
                  {o.emoji && <span aria-hidden="true">{o.emoji}</span>}
                  {o.title}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {error && (
        <p className="danger-text" role="alert">
          {error}
        </p>
      )}
      {dirty && (
        <button className="btn btn-primary btn-sm lobby-primary" disabled={busy} onClick={() => void save()}>
          Save my roles
        </button>
      )}
    </div>
  );
}
