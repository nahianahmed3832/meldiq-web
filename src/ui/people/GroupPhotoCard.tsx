import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { removeGroupPhoto, setGroupPhoto } from "../../sync/social";
import { GroupAvatar } from "../components/OrgAvatar";
import { squareJpeg } from "../workspace/photo";
/**
 * A group's photo (batch B6b, android ConversationInfoScreen): the group's admins add, change or remove it; everyone in
 * the group sees it. Like the group's name, it isn't end-to-end encrypted.
 */
export function GroupPhotoCard({ c, title }: { c: Conversation; title: string }) {
  useLocaleRender();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("group-photos") ?? false);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!offered || c.type !== "GROUP") return null;
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_change_the_photo_2e10f95")))
      .finally(() => setBusy(false));
  };
  return (
    <div className="panel-card" style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ gap: 12 }}>
        <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={52} />
        {c.canManage && (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && run(async () => setGroupPhoto(engine, c.id, await squareJpeg(e.target.files![0])))} />
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => file.current?.click()}>
              <Camera size={14} /> {c.photoRev ? uiText("workspace.interface.change_group_photo_029d701") : uiText("workspace.interface.add_a_group_photo_c91da8f")}
            </button>
            {c.photoRev && (
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => removeGroupPhoto(engine, c.id))}>
                <Localized k="workspace.interface.remove_group_photo_2d142a1" />
              </button>
            )}
          </div>
        )}
      </div>
      {c.canManage && (
        <span className="faint" style={{ fontSize: 12 }}>
          <Localized k="workspace.interface.everyone_in_the_group_sees_it_like_the_group_s_name_it_isn_t_end_8a89181" />
        </span>
      )}
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
