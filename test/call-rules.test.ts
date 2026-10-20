import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import type { TrackAudit } from "../src/call/frameAudit";
import { backoff, CallFailure, describePath, deviceIssueOf, MediaFlowMonitor, retryable, RING_WINDOW_MS, shouldRing } from "../src/call/rules";
import { MediaSecurityTracker } from "../src/call/security";
import { type CallUiState, idleCall } from "../src/call/types";
import { callStatus, duration, endedText } from "../src/ui/call/callText";

const audit = (identity: string, trackId: string, over: Partial<TrackAudit> = {}): TrackAudit => ({
  op: "decode",
  participantIdentity: identity,
  trackId,
  frames: 50,
  verified: 50,
  unencrypted: 0,
  injected: 0,
  ...over,
});
const failing = { frames: 50, verified: 0 };

/**
 * The badge claims "End-to-end encrypted" only on evidence (android MediaSecurityTrackerTest, same cases): every live
 * track encrypted or decrypted with the call's key, including at least one remote track.
 */
describe("encryption badge (D-17)", () => {
  const me = "me.d1";
  const peer = "peer.d2";
  const mic = MediaSecurityTracker.key(me, "mic");
  const peerMic = MediaSecurityTracker.key(peer, "pmic");
  const peerCam = MediaSecurityTracker.key(peer, "pcam");
  const call = () => {
    const t = new MediaSecurityTracker(4);
    t.trackAdded(mic, me, false, false);
    t.trackAdded(peerMic, peer, true, false);
    return t;
  };

  it("is verified once both directions prove themselves", () => {
    const t = call();
    expect(t.security()).toBe("verifying");
    t.audit(audit(me, "mic", { op: "encode" }));
    expect(t.security()).toBe("verifying"); // our own encryption alone proves nothing about the peer's media
    t.audit(audit(peer, "pmic"));
    expect(t.security()).toBe("encrypted");
  });

  it("shows a wrong-key peer as a problem, never as verified", () => {
    const t = call();
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic", failing));
    expect(t.security()).toBe("problem");
    expect([...t.problemIdentities()]).toEqual([peer]);
  });

  it("doesn't call a slow start a failure, and recovers when frames decrypt", () => {
    const t = call();
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic", { frames: 2, verified: 0 }));
    expect(t.security()).toBe("verifying");
    t.audit(audit(peer, "pmic", failing));
    expect(t.security()).toBe("problem");
    t.audit(audit(peer, "pmic"));
    expect(t.security()).toBe("encrypted");
  });

  it("treats a frame that would have crossed unencrypted as a problem", () => {
    const t = call();
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic", { verified: 49, unencrypted: 1 }));
    expect(t.security()).toBe("problem");
  });

  it("marks a participant LiveKit reports an encryption error for until their media decrypts again", () => {
    const t = call();
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic"));
    t.participantError(peer);
    expect(t.security()).toBe("problem");
    t.audit(audit(peer, "pmic"));
    expect(t.security()).toBe("encrypted");
  });

  it("ignores the media server's injected frames when judging failure", () => {
    const t = call();
    t.audit(audit(peer, "pmic", { frames: 40, verified: 0, injected: 40 }));
    expect(t.security()).toBe("verifying");
  });

  it("needs every live remote track to prove itself, and one silent participant keeps a group call unverified", () => {
    const t = call();
    t.trackAdded(peerCam, peer, true, false);
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic"));
    expect(t.security()).toBe("verifying"); // the camera hasn't decrypted a frame yet
    t.audit(audit(peer, "pcam"));
    expect(t.security()).toBe("encrypted");
    t.trackAdded(MediaSecurityTracker.key("other.d3", "omic"), "other.d3", true, false);
    expect(t.security()).toBe("verifying");
  });

  it("forgets removed tracks and ignores their late reports; a re-added track starts unproven", () => {
    const t = call();
    t.trackAdded(peerCam, peer, true, false);
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic"));
    t.audit(audit(peer, "pcam", failing));
    expect(t.security()).toBe("problem");
    t.trackRemoved(peerCam);
    expect(t.security()).toBe("encrypted");
    expect(t.audit(audit(peer, "pcam", failing))).toBe(false);
    expect(t.security()).toBe("encrypted");
    t.trackRemoved(peerMic);
    t.trackAdded(peerMic, peer, true, false);
    expect(t.security()).toBe("verifying");
  });

  it("counts a report that arrived before its track was registered", () => {
    const t = new MediaSecurityTracker();
    t.trackAdded(mic, me, false, false);
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic"));
    expect(t.security()).toBe("verifying");
    t.trackAdded(peerMic, peer, true, false);
    expect(t.security()).toBe("encrypted");
  });

  it("forgets a participant who left and keeps the others", () => {
    const t = call();
    const other = MediaSecurityTracker.key("other.d3", "omic");
    t.trackAdded(other, "other.d3", true, false);
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic"));
    t.audit(audit("other.d3", "omic", failing));
    expect(t.security()).toBe("problem");
    t.participantLeft("other.d3");
    expect(t.security()).toBe("encrypted");
    expect(t.audit(audit("other.d3", "omic"))).toBe(false);
  });

  it("needs no proof from muted tracks but still shows their failures", () => {
    const t = call();
    t.trackAdded(peerCam, peer, true, true); // camera off: no frames, so no proof possible
    t.audit(audit(me, "mic", { op: "encode" }));
    t.audit(audit(peer, "pmic"));
    expect(t.security()).toBe("encrypted");
    t.trackMuted(peerCam, false);
    expect(t.security()).toBe("verifying");
    t.trackMuted(peerCam, true);
    t.audit(audit(peer, "pcam", failing));
    expect(t.security()).toBe("problem");
  });

  it("vouches for a single track only while it's registered and decrypting (received media plays only then)", () => {
    const t = call();
    expect(t.proven(peerMic)).toBe(false);
    t.audit(audit(peer, "pmic"));
    expect(t.proven(peerMic)).toBe(true);
    t.audit(audit(peer, "pmic", failing));
    expect(t.proven(peerMic)).toBe(false);
    t.audit(audit(peer, "pmic"));
    t.trackRemoved(peerMic);
    expect(t.proven(peerMic)).toBe(false);
    t.audit(audit(peer, "pcam")); // a report before its track is registered isn't enough on its own
    expect(t.proven(peerCam)).toBe(false);
  });

  it("is never verified without remote media", () => {
    const t = new MediaSecurityTracker();
    t.trackAdded(mic, me, false, false);
    t.audit(audit(me, "mic", { op: "encode" }));
    expect(t.security()).toBe("verifying");
  });

  it("bounds the list of removed tracks", () => {
    const t = new MediaSecurityTracker(4);
    for (let i = 1; i <= 10; i++) t.trackRemoved(MediaSecurityTracker.key(peer, `t${i}`));
    expect(t.audit(audit(peer, "t1"))).toBe(true); // forgotten: recorded again, counts only if re-registered
    expect(t.audit(audit(peer, "t10"))).toBe(false);
  });
});

describe("call rules", () => {
  const me = "me";
  const now = 1_000_000;
  const ringing = { id: "c1", state: "RINGING", createdBy: "alice", createdAt: now - 5_000, participants: [] };

  it("rings a recovered call only when it's ringing, someone else's, recent, unhandled and unanswered here", () => {
    expect(shouldRing(ringing, me, now, new Set(), true)).toBe(true);
    expect(shouldRing(ringing, me, now, new Set(), false)).toBe(false);
    expect(shouldRing({ ...ringing, state: "ACTIVE" }, me, now, new Set(), true)).toBe(false);
    expect(shouldRing({ ...ringing, createdBy: me }, me, now, new Set(), true)).toBe(false);
    expect(shouldRing(ringing, me, now, new Set(["c1"]), true)).toBe(false);
    expect(shouldRing({ ...ringing, createdAt: now - RING_WINDOW_MS - 1 }, me, now, new Set(), true)).toBe(false);
    expect(shouldRing({ ...ringing, participants: [{ userId: me }] }, me, now, new Set(), true)).toBe(false);
  });

  it("retries only connection losses, with backoff", () => {
    for (const r of [undefined, "UNKNOWN_REASON", "SIGNAL_CLOSE", "CONNECTION_TIMEOUT", "MEDIA_FAILURE", "JOIN_FAILURE"]) expect(retryable(r)).toBe(true);
    for (const r of ["CLIENT_INITIATED", "PARTICIPANT_REMOVED", "ROOM_DELETED", "DUPLICATE_IDENTITY", "ROOM_CLOSED"]) expect(retryable(r)).toBe(false);
    expect([0, 1, 2, 3, 4].map(backoff)).toEqual([1_000, 2_000, 4_000, 6_000, 6_000]);
  });

  it("says media flows only when inbound bytes grow, and stalls after two quiet samples", () => {
    const m = new MediaFlowMonitor();
    expect(m.sample(null)).toBe("waiting");
    expect(m.sample(100)).toBe("waiting");
    expect(m.sample(100)).toBe("waiting");
    expect(m.sample(500)).toBe("flowing");
    expect(m.sample(500)).toBe("flowing");
    expect(m.sample(500)).toBe("stalled");
    expect(m.sample(900)).toBe("flowing");
    expect(m.sample(200)).toBe("flowing"); // a counter drop is a new baseline, not a stall
  });

  it("describes the network path from WebRTC stats without addresses", () => {
    const stats = [
      { id: "T", type: "transport", selectedCandidatePairId: "P" },
      { id: "P", type: "candidate-pair", localCandidateId: "L", remoteCandidateId: "R" },
      { id: "L", type: "local-candidate", candidateType: "host", protocol: "UDP", address: "192.168.0.5", port: 5000 },
    ];
    expect(describePath(stats)).toBe("udp · direct");
    const relay = [
      { id: "P", type: "candidate-pair", state: "succeeded", nominated: true, localCandidateId: "L" },
      { id: "L", type: "local-candidate", candidateType: "relay", relayProtocol: "tls", protocol: "udp" },
    ];
    expect(describePath(relay)).toBe("relay (tls)");
    expect(describePath([{ id: "T", type: "transport" }])).toBeNull();
    expect(describePath(stats)).not.toContain("192.168");
  });

  it("gives one clear message per failure class", () => {
    expect(CallFailure.forApi(new ApiError(410, "call_ended", "x"))).toBe("This call has already ended.");
    expect(CallFailure.forApi(new ApiError(404, "not_found", "x"))).toBe("This call no longer exists.");
    expect(CallFailure.forApi(new ApiError(403, "forbidden", "x"))).toBe("You're not allowed to join this call.");
    expect(CallFailure.forApi(new ApiError(503, "media_unavailable", "x"))).toBe("Calling isn't set up on this server.");
    expect(CallFailure.forApi(new ApiError(0, "network", "x"))).toMatch(/Couldn't reach the server/);
    expect(CallFailure.forApi(new Error("boom"))).toMatch(/Try again/);
    expect(CallFailure.forConnect(new Error("could not establish signal connection: timeout"))).toMatch(/didn't answer in time/);
    expect(CallFailure.forConnect(new Error("401 unauthorized"))).toMatch(/refused/);
    expect(CallFailure.forConnect("x")).toMatch(/Couldn't connect/);
    expect(CallFailure.device("microphone", "denied")).toMatch(/isn't allowed to use your microphone/);
    expect(CallFailure.device("camera", "busy")).toMatch(/camera is in use/);
  });

  it("tells a denied permission from a missing or busy device", () => {
    expect(deviceIssueOf(new DOMException("x", "NotAllowedError"))).toBe("denied");
    expect(deviceIssueOf(new DOMException("x", "NotFoundError"))).toBe("missing");
    expect(deviceIssueOf(new DOMException("x", "NotReadableError"))).toBe("busy");
    expect(deviceIssueOf({ name: "NotAllowedError" })).toBe("denied");
    expect(deviceIssueOf(new Error("odd"))).toBe("failed");
    expect(deviceIssueOf(undefined)).toBe("failed");
  });
});

describe("call status lines", () => {
  const at = (p: Partial<CallUiState>): CallUiState => ({ ...idleCall, title: "Bob", ...p });

  it("says where the call stands, from ringing to the timer", () => {
    expect(callStatus(at({ phase: "incoming", video: true }), 0)).toBe("Incoming video call");
    expect(callStatus(at({ phase: "incoming", isGroup: true, subtitle: "Bob is calling" }), 0)).toBe("Bob is calling");
    expect(callStatus(at({ phase: "outgoing" }), 0)).toBe("Calling…");
    expect(callStatus(at({ phase: "outgoing", alerted: true }), 0)).toBe("Ringing…");
    expect(callStatus(at({ phase: "outgoing", askingPermission: true, video: true }), 0)).toBe("Allow your microphone and camera in the browser's prompt…");
    expect(callStatus(at({ phase: "connecting", waitingForKey: true }), 0)).toBe("Getting the call's encryption key…");
    expect(callStatus(at({ phase: "connecting" }), 0)).toBe("Connecting…");
    expect(callStatus(at({ phase: "reconnecting" }), 0)).toBe("Reconnecting…");
    expect(callStatus(at({ phase: "connected", connectedAt: 1_000 }), 66_000)).toBe("1:05");
    expect(callStatus(at({ phase: "connected", connectedAt: 1_000, media: "stalled" }), 66_000)).toBe("Reconnecting media…");
    expect(callStatus(at({ phase: "ended", endReason: "busy" }), 0)).toBe("Busy on another call");
    expect(callStatus(at({ phase: "ended", error: CallFailure.NO_KEY }), 0)).toBe(CallFailure.NO_KEY);
  });

  it("names every way a call can end, and formats long calls", () => {
    expect(["declined", "missed", "lost", "answered elsewhere", "removed", "disconnected", "hangup", null].map(endedText)).toEqual([
      "Declined",
      "No answer",
      "The connection was lost",
      "Answered on another device",
      "You're no longer in this call",
      "Disconnected",
      "Call ended",
      "Call ended",
    ]);
    expect(duration(3_725_000)).toBe("1:02:05");
    expect(duration(-5)).toBe("0:00");
  });
});

describe("preview mirroring (android round 7 CallMediaPolicy.mirrorPreview)", () => {
  it("mirrors only your own front camera", async () => {
    const { mirrorPreview } = await import("../src/call/rules");
    expect(mirrorPreview(true, "user")).toBe(true);
    expect(mirrorPreview(true, undefined)).toBe(true); // laptop webcams don't say, and face you
    expect(mirrorPreview(true, "environment")).toBe(false); // a phone's back camera
    expect(mirrorPreview(false, "user")).toBe(false); // other people are never mirrored
  });
});
