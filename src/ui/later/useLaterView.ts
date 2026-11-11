import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LATER_VIEW, LaterViewWriter, readLaterView, type LaterViewState } from "../../application/laterView";
import type { LocalStore } from "../../store/db";

type Status = "loading" | "saving" | "saved" | "loadError" | "saveError";

export function useLaterView(store: LocalStore) {
  const writer = useMemo(() => new LaterViewWriter(store), [store]);
  const current = useRef({ ...DEFAULT_LATER_VIEW });
  const epoch = useRef({ value: 0 }).current;
  const [state, setState] = useState<{ owner: LocalStore; view: LaterViewState; status: Status } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const request = ++epoch.value;
    let live = true;
    setState(null);
    void readLaterView(store).then(
      (view) => {
        if (!live || request !== epoch.value) return;
        current.current = view;
        setState({ owner: store, view, status: "saved" });
      },
      () => {
        if (!live || request !== epoch.value) return;
        current.current = { ...DEFAULT_LATER_VIEW };
        setState({ owner: store, view: current.current, status: "loadError" });
      },
    );
    return () => {
      live = false;
      epoch.value++;
    };
  }, [store, reload, epoch]);

  const update = (patch: Partial<LaterViewState>) => {
    if (state?.owner !== store) return;
    const view = { ...current.current, ...patch };
    current.current = view;
    const request = ++epoch.value;
    setState({ owner: store, view, status: "saving" });
    void writer.write(view).then(
      () => {
        if (request === epoch.value) setState({ owner: store, view, status: "saved" });
      },
      () => {
        if (request === epoch.value) setState({ owner: store, view, status: "saveError" });
      },
    );
  };
  return {
    view: state?.owner === store ? state.view : null,
    status: state?.owner === store ? state.status : "loading",
    update,
    retry: () => (state?.status === "loadError" ? setReload((n) => n + 1) : update({})),
  };
}
