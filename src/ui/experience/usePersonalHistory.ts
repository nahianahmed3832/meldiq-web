import { useEffect } from "react";
import { HISTORY_EVENT, readPersonalHistory } from "../../application/personalHistory";
import type { LocalStore } from "../../store/db";
import { useLoad } from "../workspace/useLoad";

export function usePersonalHistory(store: LocalStore) {
  const loaded = useLoad(() => readPersonalHistory(store), [store]);
  const { reload } = loaded;
  useEffect(() => {
    const onChange = (event: Event) => {
      if ((event as CustomEvent).detail === store.name) reload();
    };
    window.addEventListener(HISTORY_EVENT, onChange);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener(HISTORY_EVENT, onChange);
      window.removeEventListener("focus", reload);
    };
  }, [reload, store.name]);
  return loaded;
}
