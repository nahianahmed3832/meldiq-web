import { describe, expect, it } from "vitest";
import { roundTripMs } from "../src/call/rules";

describe("call latency from media stats", () => {
  it("uses the chosen ICE pair, rather than an unused candidate", () => {
    expect(
      roundTripMs([
        { id: "t", type: "transport", selectedCandidatePairId: "chosen" },
        { id: "unused", type: "candidate-pair", state: "succeeded", nominated: true, currentRoundTripTime: 5 },
        { id: "chosen", type: "candidate-pair", currentRoundTripTime: 0.0437 },
      ]),
    ).toBe(44);
  });
  it("supports selected pairs without transport stats and sender RTCP stats", () => {
    expect(roundTripMs([{ id: "p", type: "candidate-pair", state: "succeeded", selected: true, currentRoundTripTime: 0.12 }])).toBe(120);
    expect(roundTripMs([{ id: "r", type: "remote-inbound-rtp", roundTripTime: 0.2 }])).toBe(200);
  });
  it("keeps missing or invalid data unknown, including during setup", () => {
    for (const value of [undefined, -1, Infinity, NaN, "0.1", 65])
      expect(roundTripMs([{ id: "p", type: "candidate-pair", state: "succeeded", nominated: true, currentRoundTripTime: value }])).toBeNull();
    expect(roundTripMs([])).toBeNull();
    expect(roundTripMs([{ id: "p", type: "candidate-pair", state: "succeeded", nominated: true, currentRoundTripTime: 0 }])).toBe(0);
  });
});
