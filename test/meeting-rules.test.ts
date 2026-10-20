import { describe, expect, it } from "vitest";
import { meetingFields, meetingIcs, meetingProblems, nextSlot, startMs, whenText } from "../src/sync/workspaceC5";

/** The meeting editor's time rules (android round 7 MeetingRulesTest), in the person's own time zone. */
describe("meeting rules", () => {
  it("local date and time become UTC in the chosen zone, DST included", () => {
    // 09:00 in Dhaka (UTC+6) is 03:00 UTC.
    expect(startMs("2026-10-20", "09:00", "Asia/Dhaka")).toBe(1_792_465_200_000);
    // London on the last Sunday of October: 10:00 is BST before the change, GMT after.
    const before = startMs("2026-10-24", "10:00", "Europe/London")!;
    const after = startMs("2026-10-26", "10:00", "Europe/London")!;
    expect(after - before).toBe(2 * 86_400_000 + 3_600_000);
    expect(startMs("2026-10-20", "9am", "UTC")).toBeNull();
    expect(startMs("20/10/2026", "09:00", "UTC")).toBeNull();
  });

  it("the next slot is the next half hour", () => {
    expect(nextSlot(startMs("2026-10-20", "14:10", "UTC")!, "UTC")).toEqual(["2026-10-20", "14:30"]);
    expect(nextSlot(startMs("2026-10-20", "23:45", "UTC")!, "UTC")).toEqual(["2026-10-21", "00:00"]);
  });

  it("problems and fields round-trip", () => {
    const now = startMs("2026-10-20", "14:10", "UTC")!;
    expect(meetingProblems("", null, "2026-10-19", "10:00", "UTC", now)).toEqual(["Give the meeting a title", "Pick a voice room", "Pick a time that hasn't passed yet"]);
    expect(meetingProblems("Sync", "c1", "2026-10-20", "15:00", "UTC", now)).toEqual([]);
    const start = startMs("2026-10-20", "15:00", "UTC")!;
    expect(meetingFields(start, start + 45 * 60_000, "UTC")).toEqual(["2026-10-20", "15:00", 45]);
    expect(whenText(start, start + 45 * 60_000, "UTC")).toBe("Tue 20 Oct, 15:00–15:45");
  });

  it("the calendar file carries the meeting in UTC, escaped", () => {
    const start = startMs("2026-10-20", "15:00", "UTC")!;
    const ics = meetingIcs({ id: "mtg_1", title: "Plan; review, part 1", description: "Line one\nLine two", startsAt: start, endsAt: start + 1_800_000, room: { id: "c1", name: "meeting-room" } });
    expect(ics).toContain("DTSTART:20261020T150000Z");
    expect(ics).toContain("DTEND:20261020T153000Z");
    expect(ics).toContain("SUMMARY:Plan\\; review\\, part 1");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });
});
