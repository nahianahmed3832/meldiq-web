import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const catalog = JSON.parse(readFileSync(new URL("../../src/sync/discovery/communityOffers.json", import.meta.url), "utf8"));
const names = {
  supercharge: "Meldiq Supercharge",
  boost: "Meldiq Discovery Boost",
  super: "Meldiq Discovery Super Boost",
  mega: "Meldiq Discovery Mega Boost",
  promoted: "Meldiq Promoted Spot",
};

export function planDefinitions(productId) {
  if (!/^PROD-[A-Z0-9]{6,50}$/.test(productId ?? "")) throw new Error("Pass an existing PayPal product ID.");
  return Object.entries(names).map(([key, name]) => {
    const offer = catalog[key];
    return {
      sku: offer.sku,
      plan: {
        product_id: productId,
        name,
        status: "CREATED",
        quantity_supported: key === "supercharge",
        billing_cycles: [
          {
            frequency: { interval_unit: offer.interval, interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: (offer.unitCents / 100).toFixed(2), currency_code: catalog.currency } },
          },
        ],
        payment_preferences: { auto_bill_outstanding: false, payment_failure_threshold: 1 },
      },
    };
  });
}

/** Validate an operator-provided GET /v1/billing/plans/{id} receipt without creating a subscription. */
export function verifyPlan(productId, sku, remote) {
  const expected = planDefinitions(productId).find((entry) => entry.sku === sku)?.plan;
  if (!expected) throw new Error("Unknown community offer.");
  const cycle = remote?.billing_cycles?.[0];
  const expectedCycle = expected.billing_cycles[0];
  const price = cycle?.pricing_scheme?.fixed_price;
  const expectedPrice = expectedCycle.pricing_scheme.fixed_price;
  const prefs = remote?.payment_preferences;
  const cents = (value) => (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : NaN);
  const mismatches = [
    [/^P-[A-Z0-9]+$/.test(remote?.id ?? ""), "plan ID"],
    [remote?.product_id === productId, "product"],
    [remote?.status === "ACTIVE", "status"],
    [remote?.quantity_supported === expected.quantity_supported, "quantity"],
    [remote?.billing_cycles?.length === 1 && cycle?.tenure_type === "REGULAR" && cycle?.sequence === 1 && cycle?.total_cycles === 0, "regular cycle"],
    [cycle?.frequency?.interval_unit === expectedCycle.frequency.interval_unit && cycle?.frequency?.interval_count === 1, "interval"],
    [price?.currency_code === expectedPrice.currency_code && cents(price?.value) === cents(expectedPrice.value), "amount or currency"],
    [!prefs?.setup_fee || cents(prefs.setup_fee.value) === 0, "setup fee"],
    [!remote?.taxes || Number(remote.taxes.percentage) === 0, "tax"],
  ]
    .filter(([ok]) => !ok)
    .map(([, field]) => field);
  if (mismatches.length) throw new Error(`Plan terms mismatch: ${mismatches.join(", ")}.`);
  return { sku, planId: remote.id };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [productId, sku, receipt] = process.argv.slice(2);
    if (Boolean(sku) !== Boolean(receipt)) throw new Error("Pass both a SKU and a plan receipt file to verify terms.");
    const result = receipt ? verifyPlan(productId, sku, JSON.parse(readFileSync(receipt, "utf8"))) : planDefinitions(productId);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
