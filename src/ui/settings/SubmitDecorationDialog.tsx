import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { apiBase } from "../../application/config";
import { useEngine } from "../../application/orbit";
import { DECORATION_LIMITS, decorationFileProblem, decorationTemplate, submitDecoration } from "../../sync/decorations";
import { Dialog } from "../components/Overlay";
import { StyledAvatar } from "../people/ProfileStyle";

interface SubmitDecorationDialogProps {
  me: { userId: string; displayName: string; avatarColor: number };
  photoRev: number | null;
  templateUrl: string | null;
  onClose: () => void;
  onSent: () => void;
}

const PREVIEW = 150;

/**
 * Make your own decoration (API 0.60.0, server docs/PROFILE_DECORATIONS.md): what makes a good one, the template, the
 * picture over your own avatar, a name, and your word that you made it. It's sent in for review; approved ones are shown
 * to everyone with your name and earn the Artist badge.
 */
export function SubmitDecorationDialog({ me, photoRev, templateUrl, onClose, onSent }: SubmitDecorationDialogProps) {
  const engine = useEngine();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [original, setOriginal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    setError(null);
    const problem = await decorationFileProblem(f);
    if (problem) return setError(problem);
    setFile(f);
    if (!name.trim())
      setName(
        f.name
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[-_]+/g, " ")
          .slice(0, 32),
      );
  };

  const ready = !!file && name.trim().length >= 2 && original && !sending;
  const send = async () => {
    if (!file || !ready) return;
    setSending(true);
    setError(null);
    try {
      await submitDecoration(engine, name, new Uint8Array(await file.arrayBuffer()));
      onSent();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "It couldn't be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  const side = Math.round(PREVIEW * 1.2);
  return (
    <Dialog title="Make a decoration" onClose={onClose} wide>
      <div className="dialog-body deco-make-dialog">
        <p className="muted" style={{ marginTop: 0 }}>
          Draw a frame for avatars and send it in. Once Meldiq's team approves it, anyone can wear it, with your name on it.
        </p>
        <ul className="deco-rules">
          <li>
            Square, {DECORATION_LIMITS.minSide} to {DECORATION_LIMITS.maxSide} pixels (512 × 512 works best), PNG, WebP or GIF with a see-through background, up to {DECORATION_LIMITS.mb} MB. Animated
            is fine.
          </li>
          <li>
            Keep the middle circle empty: that's where the avatar goes.{" "}
            <a href={templateUrl ? `${apiBase()}${templateUrl}` : decorationTemplate()} download="meldiq-decoration-template.png">
              Get the template
            </a>
          </li>
          <li>Keep big pieces to the top and sides. The bottom strip sits right above the name, so keep it light.</li>
          <li>
            <strong>Only your own original work.</strong> No art saved from the internet or another app, and no traced or edited copies of someone else's work. Copies are taken down and can cost you
            your Artist badge.
          </li>
          <li>No nudity, gore, hate, or other people's logos and characters.</li>
        </ul>
        <div className="banner info deco-perks">
          <span>
            Get your first one approved and you earn the <strong>Artist</strong> badge, your decorations on your profile for anyone to try on, room for 6 waiting at once (3 until then), and a count of
            how many people wear each one.
          </span>
        </div>

        <div className="deco-make-body">
          <div className="deco-make-preview" aria-label="Preview">
            <span className="styled-avatar" style={{ width: PREVIEW, height: PREVIEW }}>
              <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={null} size={PREVIEW} />
              {preview && <img className="deco-img" src={preview} width={side} height={side} style={{ left: (PREVIEW - side) / 2, top: (PREVIEW - side) / 2 }} alt="Your decoration" />}
            </span>
          </div>
          <div className="deco-make-form">
            <input ref={input} type="file" hidden accept={DECORATION_LIMITS.types.join(",")} onChange={(e) => void pick(e.target.files?.[0])} />
            <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={sending}>
              <ImagePlus size={16} /> {file ? "Pick another picture" : "Pick a picture"}
            </button>
            <label className="field">
              <span className="sr-only">Name</span>
              <input className="input" type="text" placeholder="Name it" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} disabled={sending} />
            </label>
            <label className="row deco-check">
              <input type="checkbox" checked={original} onChange={(e) => setOriginal(e.target.checked)} disabled={sending} />
              <span>I made this myself. It isn't taken from someone else or the internet.</span>
            </label>
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => void send()}>
              {sending ? "Sending…" : "Send it in"}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
