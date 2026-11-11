/** Try to own a browser resource until release; a second tab must not replace a live microphone/call. */
export function claimBrowserResource(name: string): Promise<(() => void) | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.locks) return Promise.resolve(() => {});
  return new Promise((resolve) => {
    void navigator.locks
      .request(name, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        return new Promise<void>((release) => resolve(release));
      })
      .catch(() => resolve(null));
  });
}
