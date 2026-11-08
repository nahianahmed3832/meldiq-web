import { useRef } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { removeCommunityBanner, setCommunityBanner } from "../../sync/workspaces";
import { ErrorLine } from "../components/SettingsCard";
import { Icon } from "../icons/Icon";
import { animatedUpload, bannerJpeg } from "./photo";
import { useAction } from "./useLoad";

export function BannerCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const t = useT();
  const animated = useOrbit((s) => s.server?.features.includes("animated-community-images") ?? false);
  const file = useRef<HTMLInputElement>(null);
  const action = useAction();
  const { id, bannerRev } = detail.org;
  return (
    <div className="field ws-banner-upload">
      <strong>{t("workspace.reference.serverBanner")}</strong>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const image = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!image) return;
          void action.act(async () => {
            const bytes = (await animatedUpload(image, "banner", animated)) ?? (await bannerJpeg(image));
            await setCommunityBanner(engine, id, bytes);
            onChanged();
          });
        }}
      />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={action.busy} onClick={() => file.current?.click()}>
          <Icon name="files.upload" size={16} /> {t("common.actions.upload")}
        </button>
        {bannerRev && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={action.busy} onClick={() => void action.act(() => removeCommunityBanner(engine, id).then(onChanged))}>
            {t("common.actions.remove")}
          </button>
        )}
      </div>
      <ErrorLine text={action.error} />
    </div>
  );
}
