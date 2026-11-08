import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { useT } from "../../i18n";
import { saveCommunitySettings } from "../../sync/communitySettings";
import { Card, ErrorLine } from "../components/SettingsCard";
import { Toggle } from "../components/Toggle";
import { useAction } from "./useLoad";

export function VoiceClipsSetting({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const t = useT();
  const action = useAction();
  return (
    <Card
      title={t("workspace.reference.allowClips")}
      sub={t("workspace.reference.allowClipsHelp")}
      actions={
        <Toggle
          checked={detail.org.voiceClips ?? false}
          disabled={action.busy}
          label={t("workspace.reference.allowClips")}
          onChange={(voiceClips) => void action.act(() => saveCommunitySettings(engine, detail.org.id, { voiceClips }).then(onChanged))}
        />
      }
    >
      <ErrorLine text={action.error} />
    </Card>
  );
}
