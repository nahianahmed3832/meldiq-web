/**
 * The pre-email way into an account, "Link with your phone" (a device-key account approved from the phone), was retired
 * from Meldiq Web with the rest of the old account system (brief v4 §13). It stays in development builds and in the
 * browser-test build only: the browser tests drive their test phones through it. A release build
 * (deploy/scripts/build-release.sh) sets neither: nothing offers it, and its screen (a separate chunk) is never loaded.
 */
export const TEST_DEVICE_LINKING: boolean = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MELDIQ_TEST_LINKING === "1";
