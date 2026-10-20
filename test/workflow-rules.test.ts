import { describe, expect, it } from "vitest";
import { blankWorkflow, fromTemplate, type WfCatalog, type WfTemplate, withTrigger, workflowProblems, workflowSummary } from "../src/sync/workflows";

/** The workflow editor's rules (android round 7 WorkflowRulesTest). */
const catalog: WfCatalog = {
  triggers: [],
  actions: [],
  unavailable: [],
  conditions: [
    { field: "member.role", triggers: ["member.joined", "member.role_changed"] },
    { field: "channel.kind", triggers: ["channel.created"] },
  ],
};

describe("workflow rules", () => {
  it("a template gets the picked channel, today and the time zone", () => {
    const t: WfTemplate = {
      id: "weekly",
      name: "Weekly",
      description: "",
      needs: ["channel", "schedule"],
      workflow: {
        trigger: { type: "schedule", schedule: { recurrence: "weekly", localTime: "09:00", anchorDate: "{today}", timeZone: "{timeZone}" } },
        conditions: [],
        actions: [{ type: "post_channel", channelId: "{channel}", text: "Hi" }],
      },
    };
    const w = fromTemplate(t, "c_1", "2026-10-20", "Asia/Dhaka");
    expect(w.actions[0].channelId).toBe("c_1");
    expect(w.trigger.schedule).toEqual({ recurrence: "weekly", localTime: "09:00", anchorDate: "2026-10-20", timeZone: "Asia/Dhaka" });
    expect(workflowProblems(w)).toEqual([]);
    const unpicked = fromTemplate(t, null, "2026-10-20", "UTC");
    expect(unpicked.actions[0].channelId).toBeUndefined();
    expect(workflowProblems(unpicked)).toEqual(["Action 1: pick a channel"]);
  });

  it("changing the trigger drops what no longer fits", () => {
    const w = {
      ...blankWorkflow(),
      name: "x",
      conditions: [{ field: "member.role", op: "is", value: "MEMBER" }],
      actions: [
        { type: "add_to_channels", channelIds: ["c"] },
        { type: "post_channel", channelId: "c", text: "hi" },
      ],
    };
    const changed = withTrigger(w, catalog, "channel.created", "2026-10-20", "UTC");
    expect(changed.conditions).toEqual([]);
    expect(changed.actions.map((a) => a.type)).toEqual(["post_channel"]);
    const scheduled = withTrigger(w, catalog, "schedule", "2026-10-20", "UTC");
    expect(scheduled.trigger.schedule?.localTime).toBe("09:00");
    expect(withTrigger(scheduled, catalog, "member.left", "2026-10-20", "UTC").trigger.schedule).toBeUndefined();
  });

  it("problems are listed in order", () => {
    const w = { ...blankWorkflow(), trigger: { type: "schedule", schedule: { recurrence: "daily", localTime: "9am", anchorDate: "2026-10-20", timeZone: "UTC" } } };
    expect(workflowProblems(w)).toEqual(["Give the workflow a name", "Set the time as HH:MM, for example 09:00", "Action 1: pick a channel", "Action 1: write the message"]);
    expect(
      workflowSummary({
        trigger: { type: "schedule", schedule: { recurrence: "daily", localTime: "09:00", anchorDate: "x", timeZone: "UTC" } },
        conditions: [{ field: "a", op: "is", value: "b" }],
        actions: [{ type: "a" }, { type: "b" }],
      }),
    ).toBe("2 actions · 1 condition · daily at 09:00");
  });
});
