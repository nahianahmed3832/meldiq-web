import { describe, expect, it } from "vitest";
import { AUDIT_FILTERS, goesToCommunity, PAUSE_CHOICES, REPORT_REASONS, reportContent, type ReportLine, running, TIMEOUT_CHOICES } from "../src/sync/reports";

/** The phone's cases (android ReportRulesTest): what a report shares and where it goes; pauses, timeouts, audit filters. */
const line = (id: string, at: number, text = `m${id}`, sender = "u1"): ReportLine => ({ id, senderUserId: sender, text, sentAt: at });

describe("reports", () => {
  it("share the message and up to five messages before it, oldest first", () => {
    const convo = Array.from({ length: 9 }, (_, i) => line(String(i + 1), (i + 1) * 1000)).reverse();
    const c = reportContent(line("8", 8000), convo);
    expect(c.text).toBe("m8");
    expect(c.sentAt).toBe(8000);
    expect(c.context?.map((x) => x.text)).toEqual(["m3", "m4", "m5", "m6", "m7"]);
    expect(c.attachments).toBeNull();
  });

  it("give the first message no context, skip empty lines and cut long text to the server's limit", () => {
    const convo = [line("1", 1, ""), line("2", 2, "x".repeat(5000))];
    const c = reportContent(convo[1], convo);
    expect(c.context).toBeNull();
    expect(c.text?.length).toBe(4000);
    expect(reportContent(convo[0], convo).text).toBeNull();
  });

  it("go to the community from channels, to Meldiq from DMs and for illegal content", () => {
    expect(goesToCommunity("spam", "CHANNEL", false)).toBe(true);
    expect(goesToCommunity("spam", "DM", true)).toBe(false);
    expect(goesToCommunity("illegal", "CHANNEL", true)).toBe(false);
    expect(goesToCommunity("harassment", null, true)).toBe(true);
    expect(goesToCommunity("harassment", null, false)).toBe(false);
    expect([...REPORT_REASONS]).toEqual(["spam", "harassment", "harmful", "private_info", "illegal", "other"]);
  });

  it("pause for 1 hour to 7 days, time out for at most 28 days, and filter the audit log with keys the server accepts", () => {
    expect(running(2000, 1000)).toBe(true);
    expect(running(1000, 1000)).toBe(false);
    expect(running(null)).toBe(false);
    expect(PAUSE_CHOICES.at(-1)?.ms).toBe(7 * 24 * 3_600_000);
    expect(TIMEOUT_CHOICES.every((c) => c.ms <= 28 * 86_400_000)).toBe(true);
    expect(AUDIT_FILTERS[0].action).toBeNull();
    expect(AUDIT_FILTERS.slice(1).every((f) => /^[a-z_.]{1,40}$/.test(f.action ?? ""))).toBe(true);
  });
});
