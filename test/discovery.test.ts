import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { type DiscoverCard, zBotDirectoryPage, zBotListingOut, zDiscoverListing, zDiscoverySettings, zOwnTemplateOut, zPromoteView, zTemplatePreviewOut } from "../src/api/discoverySchemas";
import { botDirectoryParams, discoverParams } from "../src/sync/discovery/api";
import { boostOfTier, guaranteeText, isBillingUnavailable, knownTiers, price, rankText, recordPhase, safeCheckoutUrl, weekText } from "../src/sync/discovery/promote";
import { appendPage, BOT_CHIPS, cardLabelText, cardLabelTone, chipCategory, parseTags, TEMPLATE_PATH, templateFromText, unlistedText } from "../src/sync/discovery/rules";
import { readCopy } from "./support/contracts";

/** Community parity E (docs/MELDIQ_COMMUNITY_PARITY.md §1; server docs/COMMUNITY_PARITY_API.md › Discovery) on the web. */

const card = (id: string, extra: Partial<DiscoverCard> = {}): DiscoverCard => ({
  id,
  name: id,
  description: null,
  memberCount: 1,
  photoRev: null,
  accent: null,
  bannerRev: null,
  joinPolicy: "open",
  applications: false,
  joined: false,
  tags: [],
  onlineCount: 0,
  label: null,
  official: false,
  ...extra,
});

describe("Discover's listing", () => {
  it("reads the server's answer: the Promoted row, labels, tags and who's online", () => {
    const page = zDiscoverListing.parse(readCopy("http/GET_v1_discover.json"));
    expect(page.promoted).toHaveLength(1);
    expect(page.promoted[0].label).toBe("promoted");
    expect(page.communities[0].label).toBe("mega");
    expect(page.communities[0].tags).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("keeps a card whose label it doesn't know, without a label to show", () => {
    const page = zDiscoverListing.parse({
      promoted: [],
      communities: [{ ...card("o_1"), label: "ultra", tags: ["pixel art"], onlineCount: 3 }],
      nextCursor: 30,
    });
    expect(page.communities[0].label).toBe("unknown");
    expect(cardLabelText(page.communities[0].label)).toBeNull();
    expect(cardLabelTone(page.communities[0].label)).toBeNull();
    expect(page.communities[0].onlineCount).toBe(3);
    expect(page.nextCursor).toBe(30);
  });

  it("names each label as the reference ranks them, Mega in gold", () => {
    expect(cardLabelText("promoted")).toBe("PROMOTED");
    expect(cardLabelText("mega")).toBe("MEGA BOOSTED");
    expect(cardLabelText("super")).toBe("SUPER BOOSTED");
    expect(cardLabelText("boost")).toBe("BOOSTED");
    expect(cardLabelText(null)).toBeNull();
    expect(cardLabelTone("mega")).toBe("gold");
    expect(cardLabelTone("promoted")).toBe("promoted");
    expect(cardLabelTone("boost")).toBe("plain");
  });

  it("appends a further page without repeating a community the list shifted", () => {
    const shown = [card("a"), card("b")];
    expect(appendPage(shown, [card("b"), card("c")]).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(shown.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("asks for only what's set, within the server's limits", () => {
    expect(discoverParams({})).toBe("");
    expect(discoverParams({ q: "  pixel  ", tag: "Art", cursor: 30 })).toBe("?q=pixel&tag=Art&cursor=30");
    expect(discoverParams({ q: "x".repeat(80) })).toBe(`?q=${"x".repeat(60)}`);
  });
});

describe("Profile › Discovery", () => {
  it("reads a community's settings and says why it isn't listed", () => {
    const s = zDiscoverySettings.parse(readCopy("http/GET_v1_orgs_orgId_discovery.json"));
    expect(s.minMembers).toBe(5);
    expect(s.reason).toBe("removed");
    expect(unlistedText(s.reason, s.memberCount, s.minMembers)).toMatch(/took it out of Discover/);
    expect(unlistedText(null, 9, 5)).toBeNull();
    expect(unlistedText("too_few_members", 3, 5)).toBe("Listed once it has 5 members (2 more to go).");
    expect(unlistedText("private", 9, 5)).toMatch(/private/);
  });

  it("cleans comma-separated tags as the server stores them", () => {
    expect(parseTags(" Pixel   Art, gaming,, GAMING ,lo-fi ")).toEqual({ tags: ["pixel art", "gaming", "lo-fi"] });
    expect(parseTags("")).toEqual({ tags: [] });
  });

  it("refuses tags the server would", () => {
    expect(parseTags("a, b, c, d, e, f")).toEqual({ problem: "Up to 5 tags." });
    expect("problem" in parseTags("x".repeat(25))).toBe(true);
    expect("problem" in parseTags("c++")).toBe(true);
    expect("problem" in parseTags("lo--fi")).toBe(true);
    expect(parseTags("日本語")).toEqual({ tags: ["日本語"] });
  });
});

describe("templates from a community", () => {
  it("reads a template link's preview: categories (uncategorised first), channels and roles", () => {
    const { template } = zTemplatePreviewOut.parse(readCopy("http/GET_v1_templates_code.json"));
    expect(template.code).toBe("38GHEZPVVXUK");
    expect(template.source?.name).toBe("Raid Planners");
    expect(template.counts).toEqual({ categories: 3, channels: 9, roles: 2 });
    expect(template.categories.map((c) => c.name)).toEqual(["Start here", "Talk", "Raids"]);
    expect(template.categories.flatMap((c) => c.channels).find((c) => c.name === "raid-ideas")?.format).toBe("forum");
    expect(template.roles).toEqual([
      { name: "Mods", color: "#E39B7B" },
      { name: "Crew", color: "#22D3EE" },
    ]);
  });

  it("reads uncategorised channels and a template whose source community is gone", () => {
    const { template } = zTemplatePreviewOut.parse({
      template: {
        code: "ABCDEFGHJKLM",
        name: "Bare",
        source: null,
        uses: 2,
        counts: { categories: 0, channels: 1, roles: 0 },
        updatedAt: 1,
        categories: [{ name: null, channels: [{ name: "general" }] }],
        roles: [],
      },
    });
    expect(template.source).toBeNull();
    expect(template.categories[0]).toEqual({ name: null, channels: [{ name: "general", kind: "PUBLIC", voice: false, format: "text", topic: null }] });
  });

  it("reads the community's own template, or none", () => {
    expect(zOwnTemplateOut.parse(readCopy("http/GET_v1_orgs_orgId_templates.json")).template).toBeNull();
    const made = zOwnTemplateOut.parse(readCopy("http/POST_v1_orgs_orgId_templates.json")).template;
    expect(made?.outOfDate).toBe(false);
    expect(made?.counts.channels).toBe(9);
  });

  it("finds the code in a template link or a bare code, and nothing else", () => {
    expect(templateFromText("38ghezpvvxuk")).toBe("38GHEZPVVXUK");
    expect(templateFromText("https://web.meldiq.app/template/38GHEZPVVXUK")).toBe("38GHEZPVVXUK");
    expect(templateFromText(" https://meldiq.app/template/38ghezpvvxuk/ ")).toBe("38GHEZPVVXUK");
    expect(templateFromText("https://evil.example/template/38GHEZPVVXUK")).toBeNull();
    expect(templateFromText("https://web.meldiq.app/invite/ABCD-EFGH-JKLM")).toBeNull();
    expect(templateFromText("not a link")).toBeNull();
    expect(TEMPLATE_PATH.exec("/template/38GHEZPVVXUK")?.[1]).toBe("38GHEZPVVXUK");
    expect(TEMPLATE_PATH.test("/template/../x")).toBe(false);
  });
});

describe("Promote", () => {
  const view = zPromoteView.parse(readCopy("http/GET_v1_orgs_orgId_promote.json"));

  it("reads prices, tiers, rank and the Promoted row", () => {
    expect(view.billing.available).toBe(false);
    expect(knownTiers(view.tiers).map((t) => [t.tier, price(t.weeklyCents, view.currency)])).toEqual([
      ["boost", "$3.99"],
      ["super", "$7.99"],
      ["mega", "$12.99"],
    ]);
    expect(guaranteeText(view.tiers[2].guaranteedTop)).toBe("Guaranteed a place in the top 100.");
    expect(guaranteeText(null)).toBeNull();
    expect(rankText(view.rank, view.listed)).toBe("#2");
    expect(rankText(null, false)).toBe("Not listed");
    expect(price(view.promoted.weeklyCents)).toBe("$29.99");
    expect(price(500, "eur")).toBe("5.00 EUR");
    expect(view.promoted).toMatchObject({ spotsPerWeek: 4, allTaken: false, nextSpot: { spotsLeft: 4 } });
    expect(view.visitors.weekly).toBe(2);
  });

  it("leaves out a tier it doesn't know", () => {
    const v = zPromoteView.parse({ ...readCopy<object>("http/GET_v1_orgs_orgId_promote.json"), tiers: [{ tier: "giga", weeklyCents: 1, guaranteedTop: null }] });
    expect(knownTiers(v.tiers)).toEqual([]);
  });

  it("shows a Promoted week Monday to Sunday in UTC", () => {
    const next = view.promoted.nextSpot!;
    expect(weekText(next.startsAt, next.endsAt, "en-GB")).toBe("Mon 2 Nov – Sun 8 Nov");
  });

  it("knows where a boost or booking stands", () => {
    const at = { startsAt: 100, endsAt: 200 };
    expect(recordPhase({ ...at, state: "active" }, 50)).toBe("upcoming");
    expect(recordPhase({ ...at, state: "active" }, 150)).toBe("running");
    expect(recordPhase({ ...at, state: "active" }, 200)).toBe("ended");
    expect(recordPhase({ ...at, state: "pending" }, 150)).toBe("pending");
    expect(recordPhase({ ...at, state: "cancelled" }, 150)).toBe("cancelled");
    const boosts = [{ id: "b", tier: "super" as const, state: "active" as const, source: "grant" as const, ...at }];
    expect(boostOfTier(boosts, "super", 150)?.id).toBe("b");
    expect(boostOfTier(boosts, "super", 250)).toBeNull();
    expect(boostOfTier(boosts, "mega", 150)).toBeNull();
  });

  it("tells billing being off apart from other refusals", () => {
    expect(isBillingUnavailable(new ApiError(503, "billing_unavailable", "off"))).toBe(true);
    expect(isBillingUnavailable(new ApiError(409, "promoted_full", "full"))).toBe(false);
    expect(isBillingUnavailable(new Error("x"))).toBe(false);
  });

  it("only sends people to an https checkout page", () => {
    expect(safeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test")).toBe("https://checkout.stripe.com/c/pay/cs_test");
    expect(safeCheckoutUrl("http://localhost:8080/pay")).toBe("http://localhost:8080/pay");
    expect(safeCheckoutUrl("http://example.com/pay")).toBeNull();
    expect(safeCheckoutUrl("javascript:alert(1)")).toBeNull();
    expect(safeCheckoutUrl("https://user:pw@example.com/")).toBeNull();
    expect(safeCheckoutUrl("not a url")).toBeNull();
  });
});

describe("community bot directory", () => {
  it("reads the directory and a bot's listing", () => {
    const page = zBotDirectoryPage.parse(readCopy("http/GET_v1_bot-directory.json"));
    expect(page.bots).toEqual([]);
    expect(page.categories).toContain("ai");
    const { listing } = zBotListingOut.parse(readCopy("http/GET_v2_developer_bots_id_listing.json"));
    expect(listing).toMatchObject({ listed: false, category: "other", public: true, listedAt: null });
  });

  it("reads a listed bot, an unknown category kept as unknown", () => {
    const page = zBotDirectoryPage.parse({
      bots: [
        {
          id: "u_bot",
          username: "dicey",
          displayName: "Dicey",
          description: "Rolls dice",
          category: "astrology",
          installCount: 12,
          commands: [{ name: "roll", description: "Roll" }],
          owner: null,
          listedAt: 5,
        },
      ],
      nextCursor: null,
      categories: [],
    });
    expect(page.bots[0].category).toBe("unknown");
    expect(page.bots[0].commands[0].name).toBe("roll");
  });

  it("has the reference's chips and sorts, and asks for what's chosen", () => {
    expect(BOT_CHIPS.map((c) => c.label)).toEqual(["Most used", "All", "Moderation", "Fun", "Games", "Utility", "Music", "Economy", "Social", "AI", "Other"]);
    expect(chipCategory("most_used")).toBeNull();
    expect(chipCategory("all")).toBeNull();
    expect(chipCategory("music")).toBe("music");
    expect(botDirectoryParams({})).toBe("?sort=most_used");
    expect(botDirectoryParams({ q: " dice ", category: "games", sort: "a_z", cursor: 30 })).toBe("?q=dice&category=games&sort=a_z&cursor=30");
  });
});
