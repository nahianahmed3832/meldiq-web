import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { ProfileStyle } from "../../api/schemas";

/** What the profile preview shows while you edit: the typed fields and the style picks not yet back from the server. */
export interface ProfileDraft {
  displayName: string;
  username: string;
  pronouns: string;
  aboutMe: string;
  style: ProfileStyle | null;
}

interface ProfileDraftValue {
  draft: ProfileDraft;
  update: (change: Partial<ProfileDraft>) => void;
}

const EMPTY: ProfileDraft = { displayName: "", username: "", pronouns: "", aboutMe: "", style: null };

const Ctx = createContext<ProfileDraftValue | null>(null);

/** Settings › My Profile: the editor column writes here, the sticky preview column reads it (the reference's layout). */
export function ProfileDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY);
  const update = useCallback((change: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...change })), []);
  const value = useMemo<ProfileDraftValue>(() => ({ draft, update }), [draft, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The draft, or null outside My Profile (cards used elsewhere just don't report). */
export function useProfileDraft(): ProfileDraftValue | null {
  return useContext(Ctx);
}
