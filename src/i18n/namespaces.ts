export const NAMESPACES = ["common", "auth", "onboarding", "workspace", "messaging", "calls", "files", "organization", "settings", "notifications", "billing", "errors", "admin"] as const;
export type Namespace = (typeof NAMESPACES)[number];
