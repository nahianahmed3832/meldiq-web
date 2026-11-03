import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { apiBase } from "../../application/config";
import { useEngine } from "../../application/orbit";
import { DECORATION_LIMITS, decorationFileProblem, decorationTemplate, submitDecoration } from "../../sync/decorations";
import { Dialog } from "../components/Overlay";
import { StyledAvatar } from "../people/ProfileStyle";
interface SubmitDecorationDialogProps {
  me: {
    userId: string;
    displayName: string;
    avatarColor: number;
  };
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
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(e instanceof ApiError ? e.message : uiText("settings.interface.it_couldn_t_be_sent_try_again_05ad664"));
    } finally {
      setSending(false);
    }
  };
  const side = Math.round(PREVIEW * 1.2);
  return (
    <Dialog title={uiText("settings.interface.make_a_decoration_999f57f")} onClose={onClose} wide>
      <div className="dialog-body deco-make-dialog">
        <p className="muted" style={{ marginTop: 0 }}>
          <Localized k="settings.interface.draw_a_frame_for_avatars_and_send_it_in_once_meldiq_s_team_approv_deb7174" />
        </p>
        <ul className="deco-rules">
          <li>
            <Localized
              k="settings.interface.square_to_pixels_512_512_works_best_png_webp_or_gif_with_a_see_th_5d6b4f1"
              slots={[DECORATION_LIMITS.minSide, DECORATION_LIMITS.maxSide, DECORATION_LIMITS.mb]}
            />
          </li>
          <li>
            <Localized
              k="settings.interface.keep_the_middle_circle_empty_that_s_where_the_avatar_goes_e3f5db1"
              slots={[
                <a href={templateUrl ? `${apiBase()}${templateUrl}` : decorationTemplate()} download="meldiq-decoration-template.png">
                  <Localized k="settings.interface.get_the_template_f8c5204" />
                </a>,
              ]}
            />
          </li>
          <li>
            <Localized k="settings.interface.keep_big_pieces_to_the_top_and_sides_the_bottom_strip_sits_right_893eefe" />
          </li>
          <li>
            <Localized
              k="settings.interface.no_art_saved_from_the_internet_or_another_app_and_no_traced_or_ed_893c06c"
              slots={[
                <strong>
                  <Localized k="settings.interface.only_your_own_original_work_31b2460" />
                </strong>,
              ]}
            />
          </li>
          <li>
            <Localized k="settings.interface.no_nudity_gore_hate_or_other_people_s_logos_and_characters_41797ac" />
          </li>
        </ul>
        <div className="banner info deco-perks">
          <span>
            <Localized
              k="settings.interface.get_your_first_one_approved_and_you_earn_the_badge_your_decoratio_584e612"
              slots={[
                <strong>
                  <Localized k="settings.interface.artist_1d3981b" />
                </strong>,
              ]}
            />
          </span>
        </div>

        <div className="deco-make-body">
          <div className="deco-make-preview" aria-label={uiText("organization.interface.preview_324b134")}>
            <span className="styled-avatar" style={{ width: PREVIEW, height: PREVIEW }}>
              <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={null} size={PREVIEW} />
              {preview && (
                <img
                  className="deco-img"
                  src={preview}
                  width={side}
                  height={side}
                  style={{ left: (PREVIEW - side) / 2, top: (PREVIEW - side) / 2 }}
                  alt={uiText("settings.interface.your_decoration_9813c12")}
                />
              )}
            </span>
          </div>
          <div className="deco-make-form">
            <input ref={input} type="file" hidden accept={DECORATION_LIMITS.types.join(",")} onChange={(e) => void pick(e.target.files?.[0])} />
            <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={sending}>
              <ImagePlus size={16} /> {file ? uiText("settings.interface.pick_another_picture_9be7ef2") : uiText("settings.interface.pick_a_picture_657375f")}
            </button>
            <label className="field">
              <span className="sr-only">
                <Localized k="messaging.interface.name_dcd1d52" />
              </span>
              <input
                className="input"
                type="text"
                placeholder={uiText("settings.interface.name_it_615f0f0")}
                maxLength={32}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={sending}
              />
            </label>
            <label className="row deco-check">
              <input type="checkbox" checked={original} onChange={(e) => setOriginal(e.target.checked)} disabled={sending} />
              <span>
                <Localized k="settings.interface.i_made_this_myself_it_isn_t_taken_from_someone_else_or_the_intern_874ee15" />
              </span>
            </label>
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => void send()}>
              {sending ? l10n("common.common_sending") : uiText("settings.interface.send_it_in_9ad0aab")}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
