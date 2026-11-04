import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { type Meeting, setMeetingCover, removeMeetingCover } from "../../sync/workspaceC5";
import { Dialog } from "../components/Overlay";
import { ErrorLine } from "../components/SettingsCard";
import { bannerJpeg } from "./photo";
import { useAction } from "./useLoad";

/** Event images reuse the community image pipeline. Private bytes live only for this mounted event. */
export function EventCover({ meeting, onChanged }: { meeting: Meeting; onChanged: () => void }) {
  const engine = useEngine(),
    t = useT();
  const enabled = useOrbit((s) => s.server?.features.includes("event-covers") ?? false);
  const [src, setSrc] = useState<string | null>(null),
    [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const load = useAction(),
    action = useAction();
  const [retry, setRetry] = useState(0);
  const { act } = load;
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const close = () => {
    setEditing(false);
    setFile(null);
    action.clear();
  };
  useEffect(() => {
    if (!meeting.coverId) {
      setSrc(null);
      return;
    }
    let alive = true,
      url: string | null = null;
    setSrc(null);
    void act(async () => {
      const bytes = await engine.api.bytes(`/v1/meetings/${encodeURIComponent(meeting.id)}/cover`);
      if (alive) {
        url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }));
        setSrc(url);
      }
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [engine, meeting.id, meeting.coverId, retry, act]);
  const save = (remove = false) =>
    void action.act(async () => {
      if (remove) await removeMeetingCover(engine, meeting.id, meeting.rev);
      else if (file) await setMeetingCover(engine, meeting.id, meeting.rev, await bannerJpeg(file));
      setEditing(false);
      setFile(null);
      onChanged();
    });
  const label = t("workspace.eventCover.label");
  return (
    <>
      {src && <img src={src} alt={`${label}: ${meeting.title}`} style={{ width: "100%", maxWidth: 400, aspectRatio: "5 / 2", objectFit: "cover", borderRadius: 8 }} />}
      {load.error && (
        <span>
          <ErrorLine text={load.error} />
          <button className="btn btn-ghost btn-sm" onClick={() => setRetry((n) => n + 1)}>
            {t("common.actions.retry")}
          </button>
        </span>
      )}
      {enabled && meeting.canEdit && !meeting.cancelled && (
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} aria-label={`${label}: ${meeting.title}`} onClick={() => setEditing(true)}>
          <ImagePlus size={14} />
          {label}
        </button>
      )}
      {editing && (
        <Dialog
          title={label}
          onClose={close}
          footer={
            <>
              <button className="btn btn-secondary" disabled={action.busy} onClick={close}>
                {t("common.actions.cancel")}
              </button>
              {meeting.coverId && (
                <button className="btn btn-secondary" disabled={action.busy} onClick={() => save(true)}>
                  {t("common.actions.remove")}
                </button>
              )}
              <button className="btn btn-primary" disabled={action.busy || !file} onClick={() => save()}>
                {t("common.actions.save")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <ErrorLine text={action.error} />
            {preview && <img src={preview} alt={`${label}: ${meeting.title}`} style={{ width: "100%", maxWidth: 400, aspectRatio: "5 / 2", objectFit: "cover", borderRadius: 8 }} />}
            <input type="file" accept="image/*" aria-label={label} onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={action.busy} />
          </div>
        </Dialog>
      )}
    </>
  );
}
