export type ChannelDialogTab = "overview" | "permissions" | "webhooks";

const LABELS: Record<ChannelDialogTab, string> = { overview: "Overview", permissions: "Permissions", webhooks: "Webhooks" };

/** Edit channel's tabs (the reference's Overview | Permissions | Webhooks), showing the ones this channel has. */
export function ChannelDialogTabs({ tabs, tab, onTab }: { tabs: ChannelDialogTab[]; tab: ChannelDialogTab; onTab: (t: ChannelDialogTab) => void }) {
  return (
    <div className="segmented channel-dialog-tabs" role="tablist" aria-label="Channel settings">
      {tabs.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
          {LABELS[t]}
        </button>
      ))}
    </div>
  );
}
