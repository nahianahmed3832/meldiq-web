import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { setProfileStyle } from "../../sync/account";
import { userDecorations } from "../../sync/decorations";
import { useLoad } from "../workspace/useLoad";
import { StyledAvatar } from "./ProfileStyle";
/**
 * An artist's decorations on their profile (API 0.60.0, server docs/PROFILE_DECORATIONS.md): each shown on your own
 * avatar, so you try it on just by looking, with a button to wear it.
 */
export function ArtistDecorations({ userId, name }: { userId: string; name: string }) {
  useLocaleRender();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const list = useLoad(() => userDecorations(engine, userId), [engine, userId]);
  const [worn, setWorn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!me || !list.data?.length) return null;
  const wear = async (id: string) => {
    setError(null);
    try {
      await setProfileStyle(engine, { decoration: id });
      setWorn(id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
    }
  };
  return (
    <section className="profile-box" aria-label={uiText("workspace.interface.decorations_by_value0_8f53c3b", { value0: name })}>
      <h3>
        <Localized k="workspace.interface.decorations_by_b99b99a" slots={[name]} />
      </h3>
      <div className="artist-decorations">
        {list.data.map((d) => (
          <div key={d.id} className="artist-decoration">
            <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={d.id} size={48} />
            <span className="ellipsis">{d.name}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={worn === d.id} onClick={() => void wear(d.id)}>
              {worn === d.id ? uiText("workspace.interface.wearing_5ccbf93") : uiText("workspace.interface.wear_39bb722")}
            </button>
          </div>
        ))}
      </div>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
