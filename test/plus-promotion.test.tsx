import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlusPromotion } from "../src/ui/mojo/PlusPromotion";
import { zMojoCatalog } from "../src/api/mojoSchemas";
import catalogJson from "./contract-fixtures/http/GET_v2_mojo_catalog.json";
const catalog = zMojoCatalog.parse(catalogJson);
const promotion = {
  id: "pi_1",
  campaignId: "open",
  presentation: "card" as const,
  heading: "Help keep Meldiq running",
  description: "Support an open and accessible communication platform.",
  image: null,
  cta: "Get Meldiq Plus",
  destination: "/settings/mojo" as const,
  amountMinor: 499,
  currency: "USD" as const,
  interval: "month" as const,
  expiresAt: 0,
};
const noop = () => {};
describe("reference-style Plus promotion", () => {
  it("uses catalog entitlements, truthful billing copy, visible dismissal and the server price", () => {
    const html = renderToStaticMarkup(<PlusPromotion promotion={promotion} catalog={catalog} onDismiss={noop} onSnooze={noop} onUpgrade={noop} onOptOut={noop} />);
    expect(html).toContain("$4.99/mo");
    expect(html).toContain("Dismiss Plus promotion");
    expect(html).toContain("Not now");
    expect(html).toContain("Profile customization stays free");
    expect(html).not.toContain("100 MB uploads");
    expect(html).not.toContain("Mojo");
    expect(html).not.toContain("No investors");
  });
});
