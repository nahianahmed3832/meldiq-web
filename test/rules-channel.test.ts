import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { type Conversation, type Org, zOrg } from "../src/api/schemas";
import { translate } from "../src/i18n";
import { isRulesChannel, moveRule, postingState, RULES_LIMITS, rulesBody, rulesProblem, rulesRefusalOrg, withMustAgree, zRulesView } from "../src/sync/rulesChannel";

/** A community's rules channel (API 0.65.0, feature rules-channel): what the web decides on top of the server's answers. */

const org = (rulesChannel: Org["rulesChannel"]): Org => zOrg.parse({ id: "o1", name: "Rule Makers", slug: "rule-makers", myRole: "MEMBER", memberCount: 3, createdAt: 1, rulesChannel });
const channel = (over: Partial<Conversation> = {}) => ({ id: "c_rules", type: "CHANNEL" as const, canPost: false, archived: false, timedOutUntil: null, ...over });

describe("the community view", () => {
  it("reads the rules channel summary, and null from an older server or without one", () => {
    expect(org({ channelId: "c_rules", required: true, count: 3, agreedAt: null, mustAgree: true }).rulesChannel).toEqual({
      channelId: "c_rules",
      required: true,
      count: 3,
      agreedAt: null,
      mustAgree: true,
    });
    expect(zOrg.parse({ id: "o1", name: "Old", slug: "old", myRole: "MEMBER", memberCount: 1, createdAt: 1 }).rulesChannel).toBeNull();
  });

  it("reads the rules view", () => {
    const v = zRulesView.parse({ channelId: "c1", required: false, rules: [{ id: "r1", title: "Be kind", description: null }], updatedAt: 5, agreedAt: null, mustAgree: false });
    expect(v.rules[0]).toEqual({ id: "r1", title: "Be kind", description: null });
  });
});

describe("posting and reacting", () => {
  const rules = org({ channelId: "c_rules", required: false, count: 2, agreedAt: null, mustAgree: false });

  it("lets everyone react in the rules channel, though only editors post there", () => {
    expect(isRulesChannel(rules, "c_rules")).toBe(true);
    expect(isRulesChannel(rules, "c_other")).toBe(false);
    expect(postingState(channel(), rules)).toEqual({ post: false, react: true, mustAgree: false, rulesChannel: true });
    expect(postingState(channel({ canPost: true }), rules)).toMatchObject({ post: true, react: true });
    // Not while timed out, nor in an archived rules channel; another read-only channel stays read-only.
    expect(postingState(channel({ timedOutUntil: 2_000 }), rules, 1_000).react).toBe(false);
    expect(postingState(channel({ archived: true }), rules).react).toBe(false);
    expect(postingState(channel({ id: "c_news" }), rules)).toMatchObject({ post: false, react: false, rulesChannel: false });
  });

  it("holds posting and reacting everywhere in the community until the member agrees", () => {
    const asked = org({ channelId: "c_rules", required: true, count: 2, agreedAt: null, mustAgree: true });
    expect(postingState(channel({ id: "c_chat", canPost: true }), asked)).toEqual({ post: false, react: false, mustAgree: true, rulesChannel: false });
    // DMs and groups aren't the community's.
    expect(postingState({ ...channel({ canPost: true }), type: "DM" }, asked)).toMatchObject({ post: true, mustAgree: false });
  });

  it("shows the prompt at once when the server refuses for the rules", () => {
    const refusal = new ApiError(403, "rules_not_agreed", "Agree to this community's rules before you post or react", { orgId: "o1" });
    expect(rulesRefusalOrg(refusal)).toBe("o1");
    expect(rulesRefusalOrg(new ApiError(403, "forbidden", "No"))).toBeNull();
    expect(rulesRefusalOrg(new Error("x"))).toBeNull();
    const [a, b] = withMustAgree([rules, { ...rules, id: "o2" }], "o1");
    expect(a.rulesChannel).toEqual({ channelId: "c_rules", required: true, count: 2, agreedAt: null, mustAgree: true });
    expect(b.rulesChannel?.mustAgree).toBe(false);
    expect(withMustAgree([org(null)], "o1")[0].rulesChannel).toMatchObject({ mustAgree: true, channelId: null });
  });
});

describe("the Rules settings page", () => {
  it("sends trimmed rules, leaves blank ones out and never asks to agree to nothing", () => {
    const body = rulesBody({
      channelId: "",
      required: true,
      rules: [
        { id: "r1", title: " Be kind ", description: "  " },
        { title: "", description: "" },
        { title: "No spam", description: " Ads in #promote only " },
      ],
    });
    expect(body).toEqual({
      channelId: null,
      required: true,
      rules: [
        { id: "r1", title: "Be kind", description: null },
        { title: "No spam", description: "Ads in #promote only" },
      ],
    });
    expect(rulesBody({ channelId: "c1", required: true, rules: [] })).toEqual({ channelId: "c1", required: false, rules: [] });
  });

  it("says what's missing before saving", () => {
    expect(rulesProblem({ channelId: null, required: false, rules: [] })).toBeNull();
    expect(rulesProblem({ channelId: null, required: true, rules: [] })).toMatch(/Add a rule/);
    expect(rulesProblem({ channelId: null, required: false, rules: [{ title: " ", description: "Only a description" }] })).toMatch(/title/);
    const many = Array.from({ length: RULES_LIMITS.rules + 1 }, (_, i) => ({ title: `Rule ${i}`, description: "" }));
    expect(rulesProblem({ channelId: null, required: false, rules: many })).toMatch(/25/);
  });

  it("moves a rule up and down, and leaves the ends alone", () => {
    expect(moveRule(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveRule(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveRule(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveRule(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("has its words in every language", () => {
    expect(translate("en", "rules_settings_rule", { n: 2 })).toBe("Rule 2");
    expect(translate("zh-CN", "rules_settings_rule", { n: 2 })).toBe("规则 2");
    expect(translate("bn", "rules_agree")).toBe("আমি সম্মত");
  });
});
