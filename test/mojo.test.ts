import { describe, expect, it } from "vitest";
import { zMojoCatalog, zMojoMe } from "../src/api/mojoSchemas";
import { allowedShareQualities, clampShareQuality, SHARE_QUALITIES } from "../src/call/shareQuality";
import { overCharLimit } from "../src/ui/mojo/CharLimit";
import { countChars, money, planPrice, size } from "../src/ui/mojo/mojoFormat";

/**
 * Meldiq Mojo on the web (server docs/MOJO.md): characters counted as people count them, sizes in the server's decimal
 * units, prices from what's on sale, and screen-share qualities within what the server allows.
 */
const preset = (width: number, height: number, fps: number) => ({ width, height, fps });

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
      name: "Mojo Go",
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
      name: "Mojo Plus",
      listPriceMinor: 399,
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

describe("Meldiq Mojo on the web", () => {
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
    expect(money(399, "USD")).toMatch(/3\.99/);
    expect(planPrice(catalog, "go")).toEqual({ label: expect.stringMatching(/0\.99/), onSale: true });
    // Plus isn't on sale on this server: its list price, marked so.
    expect(planPrice(catalog, "plus")).toEqual({ label: expect.stringMatching(/3\.99/), onSale: false });
  });

  it("offers only the screen-share qualities the server allows, and steps a choice down to them", () => {
    expect(allowedShareQualities(null)).toEqual(["standard", "high"]);
    expect(allowedShareQualities([preset(1280, 720, 30)])).toEqual(["standard"]);
    expect(allowedShareQualities([preset(1280, 720, 60), preset(1920, 1080, 30)])).toEqual(["standard", "smooth", "sharp"]);
    expect(allowedShareQualities([preset(1920, 1080, 60), preset(2560, 1440, 30)])).toEqual(["standard", "smooth", "sharp", "high", "max"]);
    expect(clampShareQuality("high", ["standard", "smooth", "sharp"])).toBe("sharp");
    expect(clampShareQuality("max", ["standard"])).toBe("standard");
    expect(SHARE_QUALITIES.max).toMatchObject({ width: 2560, height: 1440, frameRate: 30 });
  });

  it("reads a person's Mojo", () => {
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
