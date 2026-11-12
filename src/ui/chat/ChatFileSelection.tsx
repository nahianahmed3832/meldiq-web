import { createContext } from "react";
import type { useBulkSave } from "./BulkSaveBar";

export const ChatFileSelection = createContext<ReturnType<typeof useBulkSave> | null>(null);
