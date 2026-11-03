import { billingPlanName, operationState } from "../src/i18n/billing";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { translateRich } from "../src/i18n/runtime";
import { catalogText, localizeOfficialBot, localizePermission } from "../src/i18n/catalog";
import { ENGLISH } from "../src/i18n/english";
import type { CatalogBot } from "../src/sync/officialBots";

describe("localized inline controls and owned catalog metadata", () => {
  it("localizes owned plan and operations states while preserving identifiers and named products", () => {
    expect(billingPlanName("Free")).toBe("Free");
    expect(billingPlanName("Meldiq Plus")).toBe("Meldiq Plus");
    expect(operationState("accepted")).toBe("Approved");
    expect(operationState("complete")).toBe("Completed");
    expect(operationState("rejected")).toBe("Rejected");
    expect(operationState("future_status")).toBe("future status");
  });

  it("retains link behavior while translating its inline label as part of the sentence", () => {
    const result = translateRich("en", "billing.interface.by_purchasing_you_agree_to_the_da1072c", [
      <a href="/terms" target="_blank" rel="noreferrer">
        Old label
      </a>,
    ]);
    const html = renderToStaticMarkup(<p>{result}</p>);
    expect(html).toBe('<p>By purchasing, you agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>.</p>');
  });

  it("preserves and escapes user content supplied through an empty React slot", () => {
    const name = '<script>alert("Save")</script>';
    const result = translateRich("en", "files.interface.from_your_connections_they_aren_t_told_24325a0", [<strong>Remove</strong>, name]);
    const html = renderToStaticMarkup(<p>{result}</p>);
    expect(html).toContain("&lt;script&gt;alert(&quot;Save&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(name).toBe('<script>alert("Save")</script>');
  });

  it("only localizes catalog copy matching the audited source", () => {
    const source = ENGLISH.organization.builtIn.permissionCatalog.workspace_edit;
    const permission = { key: "workspace.edit", label: source.label, description: "A community-created description" };
    const localized = localizePermission(permission);
    expect(localizePermission(permission)).toBe(localized);
    expect(localizePermission(localized)).toBe(localized);
    expect(localized.label).toBe(source.label);
    expect(localized.description).toBe(permission.description);
    expect(catalogText("organization.builtIn.permissionCatalog.workspace_edit.label", "New server copy")).toBe("New server copy");
  });

  it("keeps bot identity and community draft content intact", () => {
    const source = ENGLISH.organization.builtIn.officialBots.welcomer;
    const bot: CatalogBot = {
      key: "welcomer",
      name: "Our community's greeter",
      tagline: source.tagline,
      description: source.description.replaceAll("''", "'"),
      color: "#5865f2",
      icon: "👋",
      sample: "Welcome, Save!",
      features: [],
      commands: [{ usage: "/welcome", description: "Custom command copy" }],
      limits: [],
      available: true,
      unavailableReason: null,
    };
    const localized = localizeOfficialBot(bot);
    expect(localizeOfficialBot(bot)).toBe(localized);
    expect(localizeOfficialBot(localized)).toBe(localized);
    expect(localized.name).toBe(bot.name);
    expect(localized.sample).toBe(bot.sample);
    expect(localized.commands[0]).toEqual(bot.commands[0]);
  });
});
