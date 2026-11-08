import { ArrowDown, ArrowUp, ChevronDown, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import type { Category } from "../../api/communitySchemas";
import type { Conversation } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { useT } from "../../i18n";
import { saveLayout } from "../../sync/community";
import { channelSections, layoutPositions, moved, type LayoutChannel } from "../../sync/communityRules";
import { CategoryNameDialog } from "../community/CategoryDialogs";
import { ChannelGlyph } from "../community/ChannelDialogs";
import { useDragSort } from "../components/dragSort";
import { ErrorLine } from "../components/SettingsCard";
import { useAction } from "./useLoad";

type Layout = { categories?: string[]; channels?: LayoutChannel[] };

export function ChannelOrder({ orgId, channels, categories, canCreate, reload }: { orgId: string; channels: Conversation[]; categories: Category[]; canCreate: boolean; reload: () => void }) {
  const t = useT();
  const engine = useEngine();
  const [creating, setCreating] = useState(false);
  const [undo, setUndo] = useState<{ before: Layout; after: Layout } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const action = useAction();
  const rows = channels.map((channel) => ({ ...channel, name: channel.name ?? channel.id }));
  const groups = channelSections(rows, categories, true);
  const categoryIds = groups.flatMap((group) => group.categoryId ?? []);
  const siblings = (categoryId: string | null) => groups.find((group) => group.categoryId === categoryId)?.channels.map(({ id }) => id) ?? [];

  const change = async (after: Layout, before: Layout | null) => {
    if (locked.current) return;
    locked.current = true;
    try {
      if (await action.act(() => saveLayout(engine, orgId, after))) {
        setUndo(before ? { before, after } : null);
        reload();
      }
    } finally {
      locked.current = false;
    }
  };
  // Undo applies only if the affected order still matches our write.
  const canUndo =
    undo &&
    (undo.after.categories
      ? undo.after.categories.join() === categoryIds.join()
      : undo.after.channels?.every((item) => {
          const channel = channels.find(({ id }) => id === item.id);
          return channel?.categoryId === item.categoryId && channel.position === item.position;
        }));
  const moveCategory = (ordered: string[]) => void change({ categories: ordered }, { categories: categoryIds });
  const moveChannel = (id: string, from: string | null, to: string | null, ordered: string[]) => {
    const previous = layoutPositions(to, siblings(to));
    if (from !== to) previous.push({ id, categoryId: from, position: channels.find((channel) => channel.id === id)?.position ?? 0 });
    void change({ channels: layoutPositions(to, ordered) }, { channels: previous });
  };
  useDragSort(
    box,
    (drag, target, at) => {
      if (drag.kind === "category") {
        if (target.kind !== "category" || at === "into") return;
        const ordered = categoryIds.filter((id) => id !== drag.id);
        const index = ordered.indexOf(target.id);
        if (index < 0) return;
        ordered.splice(index + (at === "after" ? 1 : 0), 0, drag.id);
        moveCategory(ordered);
        return;
      }
      if (target.kind === "category" && at !== "into") return;
      const to = target.kind === "category" ? target.id : target.group;
      const ordered = siblings(to).filter((id) => id !== drag.id);
      const index = at === "into" ? ordered.length : ordered.indexOf(target.id);
      if (index < 0) return;
      ordered.splice(index + (at === "after" ? 1 : 0), 0, drag.id);
      moveChannel(drag.id, drag.group, to, ordered);
    },
    !action.busy,
  );

  const buttons = (name: string, ids: string[], id: string, onMove: (ids: string[]) => void) => {
    const index = ids.indexOf(id);
    return (
      <span className="row" data-no-drag>
        <button className="icon-btn" type="button" aria-label={t("workspace.reference.moveUp", { name })} disabled={action.busy || index <= 0} onClick={() => onMove(moved(ids, id, -1))}>
          <ArrowUp size={16} aria-hidden />
        </button>
        <button className="icon-btn" type="button" aria-label={t("workspace.reference.moveDown", { name })} disabled={action.busy || index >= ids.length - 1} onClick={() => onMove(moved(ids, id, 1))}>
          <ArrowDown size={16} aria-hidden />
        </button>
      </span>
    );
  };
  const renderRows = (items: typeof rows, categoryId: string | null) =>
    items.map((channel) => (
      <li key={channel.id} className="ws-order-row" data-drag={channel.id} data-drag-kind="channel" data-drag-group={categoryId ?? undefined}>
        <ChannelGlyph kind={channel.kind} voice={channel.voice} format={channel.format} />
        <span className="grow">{channel.name}</span>
        {buttons(channel.name, siblings(categoryId), channel.id, (ordered) => moveChannel(channel.id, categoryId, categoryId, ordered))}
      </li>
    ));
  return (
    <section className="ws-channel-order" aria-label={t("workspace.reference.arrangeChannels")}>
      <div className="ws-order-actions">
        <p className="muted grow">{t("workspace.reference.arrangeHelp")}</p>
        <button type="button" className="btn btn-ghost" disabled={!canUndo || action.busy} onClick={() => undo && void change(undo.before, null)}>
          <RotateCcw size={16} aria-hidden /> {t("workspace.reference.undoOrder")}
        </button>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t("organization.interface.create_category_12748aa")}
          </button>
        )}
      </div>
      <ErrorLine text={action.error} />
      <div ref={box} className="ws-order-list" aria-busy={action.busy}>
        {groups.map(({ key, categoryId, title, channels: items }) => (
          <div key={key}>
            <div className="ws-order-section" data-drag={categoryId ?? undefined} data-drag-kind="category" data-drag-into="channel">
              <ChevronDown size={16} aria-hidden />
              <strong className="grow">{title ?? t("organization.channels")}</strong>
              <span className="ws-order-count">{items.length}</span>
              {categoryId && buttons(title ?? "", categoryIds, categoryId, moveCategory)}
            </div>
            <ul>{renderRows(items, categoryId)}</ul>
          </div>
        ))}
      </div>
      {creating && <CategoryNameDialog orgId={orgId} category={null} onClose={() => setCreating(false)} />}
    </section>
  );
}
