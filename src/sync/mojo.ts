import { z } from "zod";
import { ApiError } from "../api/client";
import { type MojoCatalog, type MojoMe, type OrgSparks, type OwnerBilling, type PlanKey, zCheckoutStarted, zMojoCatalog, zMojoMe, zOrgSparks, zOwnerBilling } from "../api/mojoSchemas";

/**
 * Meldiq Mojo on this browser (server docs/MOJO.md): the catalog, the person's plan, perks, Sparks, badge and gifts,
 * and each community's Spark level. The server decides everything: this only reads its answers and asks it to act.
 * Refreshed at start, on the `entitlements.changed` frame, and when the person comes back from a payment page.
 */
export interface MojoState {
  catalog: MojoCatalog | null;
  me: MojoMe | null;
  /** The account's own plan subscription (renewal date, a scheduled cancellation), when billing is on. */
  billing: OwnerBilling | null;
  /** Spark levels of communities looked at, by id. */
  orgs: Record<string, OrgSparks>;
  /** False until the first answer (or when this server has no Mojo: an older API). */
  available: boolean;
  error: string | null;
}

export const initialMojo: MojoState = { catalog: null, me: null, billing: null, orgs: {}, available: false, error: null };

interface MojoHost {
  json<S extends z.ZodTypeAny>(method: string, path: string, schema: S, init?: { body?: unknown }): Promise<z.infer<S>>;
  publish(update: (m: MojoState) => MojoState): void;
  get(): MojoState;
}

const zOk = z.unknown();

export class MojoSync {
  private refreshing: Promise<void> | null = null;

  constructor(private readonly host: MojoHost) {}

  /** Reads the catalog, the person's Mojo and their plan subscription again. */
  refresh(): Promise<void> {
    this.refreshing ??= this.load().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async load(): Promise<void> {
    try {
      const [catalog, me] = await Promise.all([this.host.json("GET", "/v2/mojo/catalog", zMojoCatalog), this.host.json("GET", "/v2/mojo/me", zMojoMe)]);
      const billing = catalog.onSale.mode ? await this.host.json("GET", "/v2/billing/account", zOwnerBilling).catch(() => null) : null;
      this.host.publish((m) => ({ ...m, catalog, me, billing, available: true, error: null }));
      // Levels already on screen may have changed too (a Spark given elsewhere, a plan that lapsed).
      await Promise.all(Object.keys(this.host.get().orgs).map((id) => this.loadOrg(id)));
    } catch (e) {
      // An API without Mojo (older server) answers 404: the app simply shows no Mojo.
      const missing = e instanceof ApiError && e.status === 404;
      this.host.publish((m) => ({ ...m, available: m.available && !missing, error: missing ? null : e instanceof Error ? e.message : "Couldn't load Meldiq Mojo" }));
    }
  }

  /** A community's Spark level (read when its panel or the Spark dialog opens). */
  async loadOrg(orgId: string): Promise<OrgSparks | null> {
    try {
      const s = await this.host.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/sparks`, zOrgSparks);
      this.host.publish((m) => ({ ...m, orgs: { ...m.orgs, [orgId]: s } }));
      return s;
    } catch {
      return null;
    }
  }

  /** Opens the payment provider's page for a plan (Go, Plus) and comes back to this app's Mojo page. */
  async checkout(planKey: Exclude<PlanKey, "free">): Promise<string | null> {
    const r = await this.host.json("POST", "/v2/billing/checkout", zCheckoutStarted, { body: { planKey, returnTo: "web" } });
    return r.url;
  }

  async buySparks(quantity: number): Promise<string | null> {
    const r = await this.host.json("POST", "/v2/mojo/sparks/checkout", zCheckoutStarted, { body: { quantity, returnTo: "web" } });
    return r.url;
  }

  /** The provider's page for payment method, invoices and cancellation. */
  async portal(): Promise<string> {
    return (await this.host.json("POST", "/v2/billing/portal", z.object({ url: z.string() }), { body: { returnTo: "web" } })).url;
  }

  /** After a payment page: asks the server to read the provider's state now (a missed webhook), then refreshes. */
  async afterReturn(): Promise<void> {
    await this.host.json("POST", "/v2/billing/sync", zOk, { body: {} }).catch(() => undefined);
    await this.refresh();
  }

  async giveSpark(orgId: string): Promise<void> {
    await this.host.json("POST", "/v2/mojo/sparks", zOk, { body: { orgId } });
    await Promise.all([this.refresh(), this.loadOrg(orgId)]);
  }

  async moveSpark(sparkId: string, orgId: string): Promise<void> {
    await this.host.json("POST", `/v2/mojo/sparks/${encodeURIComponent(sparkId)}/move`, zOk, { body: { orgId } });
    await this.refresh();
  }

  async removeSpark(sparkId: string): Promise<void> {
    await this.host.json("DELETE", `/v2/mojo/sparks/${encodeURIComponent(sparkId)}`, zOk);
    await this.refresh();
  }

  async gift(input: { recipientUserId: string; planKey: "go" | "plus"; months: number; note: string }): Promise<string | null> {
    const r = await this.host.json("POST", "/v2/mojo/gifts", zCheckoutStarted, { body: { ...input, note: input.note.trim() || null, returnTo: "web" } });
    return r.url;
  }

  async redeemGift(giftId: string): Promise<void> {
    await this.host.json("POST", `/v2/mojo/gifts/${encodeURIComponent(giftId)}/redeem`, zOk);
    await this.refresh();
  }

  async setBadgeHidden(hidden: boolean): Promise<void> {
    await this.host.json("PUT", "/v2/mojo/badge", zOk, { body: { hidden } });
    await this.refresh();
  }
}
