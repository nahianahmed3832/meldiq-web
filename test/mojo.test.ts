import { describe, expect, it } from "vitest";
import { zMojoCatalog, zMojoMe } from "../src/api/mojoSchemas";
import { overCharLimit } from "../src/ui/mojo/CharLimit";
import { countChars, money, planPrice, planVideoLabel, size } from "../src/ui/mojo/mojoFormat";

/**
 * Meldiq Mojo on the web (server docs/MOJO.md): characters counted as people count them, sizes in the server's decimal
 * units, prices from what's on sale, and screen-share qualities within what the server allows.
 */

const catalog = zMojoCatalog.parse({
  version: "2026-10-28.1",
  units: { mb: 1_000_000, gb: 1_000_000_000 },
  plans: [
    {
      key: "free",
      name: "Free",
      listPriceMinor: 0,
      messageChars: 1000,
      uploadBytes: 50_000_000,
      screen: ["720p30"],
      sparks: 0,
      badge: null,
      check: false,
      customItems: 20,
      bots: 2,
      botReview: "regular",
    },
    {
      key: "go",
      name: "Legacy Go",
      listPriceMinor: 99,
      messageChars: 2000,
      uploadBytes: 200_000_000,
      screen: ["720p60", "1080p30"],
      sparks: 1,
      badge: "go",
      check: false,
      customItems: 50,
      bots: 4,
      botReview: "regular",
    },
    {
      key: "plus",
      name: "Meldiq Plus",
      listPriceMinor: 499,
      messageChars: 5000,
      uploadBytes: 2_000_000_000,
      screen: ["1080p60", "1440p30"],
      sparks: 2,
      badge: "plus",
      check: true,
      customItems: 250,
      bots: 10,
      botReview: "priority",
    },
  ],
  screenPresets: [{ id: "720p30", label: "720p 30 fps", width: 1280, height: 720, fps: 30 }],
  spark: { listPriceMinor: 99, interval: "month", maxPurchase: 20, levels: [] },
  gifts: { months: [1, 3, 12], noteMax: 280 },
  enforced: true,
  onSale: { mode: "test", go: { currency: "USD", amountMinor: 99 }, plus: null, spark: null, gifts: true },
  // A newer server's field: read tolerantly.
  somethingNew: 1,
});

describe("Meldiq Plus on the web", () => {
  it("counts characters as people do: an emoji with its skin tone, a flag, a family is one", () => {
    expect(countChars("hello")).toBe(5);
    expect(countChars("👍🏽")).toBe(1);
    expect(countChars("🇧🇩")).toBe(1);
    expect(countChars("👨‍👩‍👧")).toBe(1);
    expect(countChars("আমি")).toBe(2);
    expect(overCharLimit("x".repeat(1000), 1000)).toBe(false);
    expect(overCharLimit("x".repeat(1001), 1000)).toBe(true);
    // 1,000 flags are 2,000 code points but 1,000 characters.
    expect(overCharLimit("🇧🇩".repeat(1000), 1000)).toBe(false);
    expect(overCharLimit("x".repeat(10_000), null)).toBe(false);
  });

  it("shows sizes in the server's decimal units and prices from what's on sale", () => {
    expect(size(50_000_000)).toBe("50 MB");
    expect(size(2_000_000_000)).toBe("2 GB");
    expect(size(1_024_000_000)).toBe("1,024 MB");
    expect(money(399, "USD")).toMatch(/3\.99/);
    expect(planPrice(catalog, "go")).toEqual({ label: "Discontinued", onSale: false });
    // Plus isn't on sale on this server: its list price, marked so.
    expect(planPrice(catalog, "plus")).toEqual({ label: expect.stringMatching(/4\.99/), onSale: false });
  });

  it("reads a person's Meldiq Plus", () => {
    const me = zMojoMe.parse({
      plan: "go",
      perks: catalog.plans[1],
      sparks: { included: 1, purchased: 0, total: 1, free: 0, assignments: [{ id: "spk_1", orgId: "o1", orgName: "Lab", assignedAt: 1, paused: false, member: true }], subscription: null },
      badge: { kind: "go", check: false, hidden: false },
      gifts: { received: [], sent: [] },
    });
    expect(me.sparks.assignments[0]?.orgName).toBe("Lab");
  });
});

describe("screen labels", () => {
  it("lists the web plan targets independently of older server presets", () => {
    expect(planVideoLabel("free")).toBe("Up to 720p · 60 fps");
    expect(planVideoLabel("go")).toBe("Up to 720p · 60 fps");
    expect(planVideoLabel("plus")).toBe("Up to 1080p · 60 fps");
  });
});
