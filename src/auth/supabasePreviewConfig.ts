import { z } from "zod";

const projectRef = "bkvlxbsnzqkhbifawcww";
export const zSupabasePreview = z.strictObject({
  mode: z.literal("staging-check"),
  projectRef: z.literal(projectRef),
  url: z.literal(`https://${projectRef}.supabase.co`),
  publishableKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{8,200}$/),
});
export type SupabasePreviewConfig = z.infer<typeof zSupabasePreview>;

/** An explicit deployment setting plus a dedicated test origin; production never exposes the preview. */
export function allowedSupabasePreview(environment: string, value: false | SupabasePreviewConfig, hostname: string): SupabasePreviewConfig | null {
  return environment === "staging" && value && ["localhost", "127.0.0.1", "[::1]", "staging-web.meldiq.app"].includes(hostname) ? value : null;
}
