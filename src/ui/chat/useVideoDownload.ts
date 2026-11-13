import { useSyncExternalStore } from "react";
import { useEngine } from "../../application/orbit";

const never = () => false;
const noSubscription = () => () => undefined;

export function useVideoDownload(id: string | null): boolean {
  const { store } = useEngine();
  return useSyncExternalStore(id ? store.subscribeVideoDownloads : noSubscription, () => id !== null && store.hasVideoDownload(id), never);
}
