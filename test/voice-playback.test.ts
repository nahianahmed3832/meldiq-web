import { describe, expect, it } from "vitest";
import { type AudioOutput, VoicePlayback } from "../src/application/voicePlayback";

/** A stand-in audio element: play() answers when the test says, and events fire on demand. */
class FakeAudio implements AudioOutput {
  src = "";
  currentTime = 0;
  playbackRate = 1;
  paused = true;
  plays: { src: string; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private readonly listeners = new Map<string, (() => void)[]>();

  play(): Promise<void> {
    this.paused = false;
    return new Promise((resolve, reject) => this.plays.push({ src: this.src, resolve, reject }));
  }
  pause(): void {
    const was = this.paused;
    this.paused = true;
    if (!was) this.fire("pause");
  }
  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }
  load(): void {}
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string): void {
    for (const l of this.listeners.get(type) ?? []) l();
  }
}

function setup() {
  const audios: FakeAudio[] = [];
  const player = new VoicePlayback(() => {
    const a = new FakeAudio();
    audios.push(a);
    return a;
  });
  return { player, audios, audio: () => audios[0] };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("one voice message at a time", () => {
  it("starting B pauses A at once, through one audio element, and both show the right state", () => {
    const { player, audios, audio } = setup();
    player.play("A", "blob:a");
    expect(player.snapshot()).toMatchObject({ key: "A", status: "playing" });
    audio().currentTime = 4.2;
    audio().fire("timeupdate");
    player.play("B", "blob:b");
    expect(audios).toHaveLength(1);
    expect(audio().src).toBe("blob:b");
    expect(player.snapshot()).toMatchObject({ key: "B", status: "playing", positionMs: 0 });
    // A is no longer current, and kept its place.
    expect(player.positionOf("A")).toBe(4200);
  });

  it("resumes A where it was left, at the chosen speed", () => {
    const { player, audio } = setup();
    player.play("A", "blob:a");
    audio().currentTime = 3;
    audio().fire("timeupdate");
    player.cycleRate();
    player.play("B", "blob:b");
    player.play("A", "blob:a");
    expect(audio().currentTime).toBe(3);
    expect(audio().playbackRate).toBe(1.5);
    expect(player.snapshot()).toMatchObject({ key: "A", status: "playing", rate: 1.5 });
  });

  it("rapid clicks end with the last one playing and the others' rejected play() ignored", async () => {
    const { player, audio } = setup();
    player.play("A", "blob:a");
    player.play("B", "blob:b");
    player.play("C", "blob:c");
    const abort = Object.assign(new Error("interrupted"), { name: "AbortError" });
    audio().plays[0].reject(abort);
    audio().plays[1].reject(abort);
    audio().plays[2].resolve();
    await tick();
    expect(player.snapshot()).toMatchObject({ key: "C", status: "playing", failed: null });
    expect(audio().src).toBe("blob:c");
  });

  it("a clip still decrypting doesn't start if another was asked for meanwhile", () => {
    const { player, audio } = setup();
    player.play("A", null);
    expect(player.snapshot()).toMatchObject({ key: "A", status: "loading" });
    player.play("B", "blob:b");
    player.provide("A", "blob:a");
    expect(player.snapshot().key).toBe("B");
    expect(audio().src).toBe("blob:b");
    player.play("C", null);
    player.provide("C", "blob:c");
    expect(player.snapshot()).toMatchObject({ key: "C", status: "playing" });
  });

  it("says why when the browser refuses to play, and the next click tries again", async () => {
    const { player, audio } = setup();
    player.play("A", "blob:a");
    audio().plays[0].reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    await tick();
    expect(player.snapshot()).toMatchObject({ key: "A", status: "paused", failed: "Your browser blocked playback. Click play again." });
    player.toggle("A", "blob:a");
    expect(player.snapshot()).toMatchObject({ status: "playing", failed: null });
  });

  it("pauses and toggles, seeks the current clip or remembers a place for another, and rewinds at the end", () => {
    const { player, audio } = setup();
    player.toggle("A", "blob:a");
    player.toggle("A", "blob:a");
    expect(player.snapshot().status).toBe("paused");
    player.seek("A", 2500);
    expect(audio().currentTime).toBe(2.5);
    player.seek("B", 7000);
    expect(player.positionOf("B")).toBe(7000);
    player.toggle("A", "blob:a");
    audio().fire("ended");
    expect(player.snapshot()).toMatchObject({ key: "A", status: "idle", positionMs: 0 });
    expect(player.positionOf("A")).toBe(0);
  });

  it("stops when its player goes away, and on sign-out forgets everything", () => {
    const { player, audio } = setup();
    player.play("A", "blob:a");
    player.release("B"); // another player going away changes nothing
    expect(player.snapshot().status).toBe("playing");
    player.release("A");
    expect(audio().paused).toBe(true);
    expect(audio().src).toBe("");
    expect(player.snapshot()).toMatchObject({ key: null, status: "idle" });
    player.play("B", "blob:b");
    audio().currentTime = 1;
    audio().fire("timeupdate");
    player.reset();
    expect(audio().paused).toBe(true);
    expect(player.snapshot()).toEqual({ key: null, status: "idle", positionMs: 0, rate: 1, failed: null });
    expect(player.positionOf("B")).toBe(0);
  });

  it("follows a pause from outside the page (media keys)", () => {
    const { player, audio } = setup();
    player.play("A", "blob:a");
    audio().pause();
    expect(player.snapshot().status).toBe("paused");
  });

  it("notifies subscribers with a new snapshot on each change", () => {
    const { player } = setup();
    const seen: string[] = [];
    const stop = player.subscribe(() => seen.push(`${player.snapshot().key}:${player.snapshot().status}`));
    player.play("A", "blob:a");
    player.play("B", "blob:b");
    stop();
    player.pause("B");
    expect(seen).toEqual(["A:playing", "B:playing"]);
  });
});
