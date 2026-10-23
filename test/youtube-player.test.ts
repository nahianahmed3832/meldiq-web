import { describe, expect, it } from "vitest";
import { detectMediaLink, embedUrl } from "../src/sync/mediaLinks";

describe("YouTube in Meldiq", () => {
  it("YouTube videos, Shorts and live streams carry the id the in-app player plays", () => {
    expect(detectMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")?.videoId).toBe("dQw4w9WgXcQ");
    expect(detectMediaLink("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(detectMediaLink("https://youtube.com/shorts/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(detectMediaLink("https://m.youtube.com/live/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    // Music, playlists and other providers open in their own app instead.
    expect(detectMediaLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBeUndefined();
    expect(detectMediaLink("https://www.youtube.com/playlist?list=PL123")?.videoId).toBeUndefined();
    expect(detectMediaLink("https://vimeo.com/123456")?.videoId).toBeUndefined();
  });

  it("only a well-formed id becomes a privacy-enhanced player address", () => {
    expect(embedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0");
    expect(embedUrl('x"><script>')).toBeNull();
  });
});
