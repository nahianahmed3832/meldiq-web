import { useEffect, useSyncExternalStore } from "react";
import { cancelNavigation, discardAndNavigate, hasUnsavedChanges, pendingNavigation, registerUnsavedEditor, subscribeNavigationGuard } from "../../application/navigationGuard";
import { useT } from "../../i18n";
import { Dialog } from "./Overlay";

export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => (dirty ? registerUnsavedEditor() : undefined), [dirty]);
}
export function UnsavedChangesDialog() {
  const t = useT();
  const pending = useSyncExternalStore(subscribeNavigationGuard, pendingNavigation, () => false);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  return pending ? (
    <Dialog
      title={t("settings.navigation.discardTitle")}
      onClose={cancelNavigation}
      footer={
        <>
          <button className="btn btn-secondary" onClick={cancelNavigation}>
            {t("settings.navigation.stay")}
          </button>
          <button className="btn btn-danger" onClick={discardAndNavigate}>
            {t("settings.navigation.discard")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p>{t("settings.navigation.discardDescription")}</p>
      </div>
    </Dialog>
  ) : null;
}
