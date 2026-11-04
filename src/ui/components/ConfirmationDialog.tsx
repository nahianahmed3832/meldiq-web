import { useSyncExternalStore } from "react";
import { useT } from "../../i18n";
import { Dialog } from "./Overlay";

type Confirmation = { message: string; resolve: (confirmed: boolean) => void };
let current: Confirmation | null = null;
const listeners = new Set<() => void>();
const snapshot = () => current;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const emit = () => listeners.forEach((listener) => listener());

/** One accessible confirmation pattern for destructive actions across every feature area. */
export function confirmAction(message: string): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { message, resolve };
    emit();
  });
}
function answer(confirmed: boolean) {
  const request = current;
  current = null;
  emit();
  request?.resolve(confirmed);
}
export function ConfirmationDialog() {
  const t = useT();
  const request = useSyncExternalStore(subscribe, snapshot, () => null);
  return request ? (
    <Dialog
      title={t("common.actions.confirm")}
      onClose={() => answer(false)}
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => answer(false)}>
            {t("common.actions.cancel")}
          </button>
          <button className="btn btn-danger" onClick={() => answer(true)}>
            {t("common.actions.confirm")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p>{request.message}</p>
      </div>
    </Dialog>
  ) : null;
}
