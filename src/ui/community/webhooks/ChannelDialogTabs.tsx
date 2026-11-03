import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
export type ChannelDialogTab = "overview" | "permissions" | "webhooks";
const LABELS: Record<ChannelDialogTab, string> = {
  get overview() {
    return uiText("workspace.interface.overview_d4b1ea5");
  },
  get permissions() {
    return uiText("organization.permissions");
  },
  get webhooks() {
    return uiText("organization.interface.webhooks_45808d7");
  },
};
/** Edit channel's tabs (the reference's Overview | Permissions | Webhooks), showing the ones this channel has. */
export function ChannelDialogTabs({ tabs, tab, onTab }: { tabs: ChannelDialogTab[]; tab: ChannelDialogTab; onTab: (t: ChannelDialogTab) => void }) {
  useLocaleRender();
  return (
    <div className="segmented channel-dialog-tabs" role="tablist" aria-label={uiText("organization.interface.channel_settings_afc219f")}>
      {tabs.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
          {LABELS[t]}
        </button>
      ))}
    </div>
  );
}
