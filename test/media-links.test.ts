import { describe, expect, it } from "vitest";
import { detectMediaLink, findMediaLink } from "../src/sync/mediaLinks";

/** The phone's recognition of music and video links (android MediaLinks), from the address alone. */
describe("music and video links", () => {
  it("recognises YouTube, YouTube Music, Spotify, SoundCloud and Vimeo links by what they are", () => {
    const cases: [string, string, string][] = [
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "YouTube", "video"],
      ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "YouTube", "video"],
      ["https://youtu.be/dQw4w9WgXcQ", "YouTube", "video"],
      ["https://www.youtube.com/shorts/aBcDeFgHiJk", "YouTube", "short"],
      ["https://www.youtube.com/live/aBcDeFgHiJk", "YouTube", "live"],
      ["https://www.youtube.com/playlist?list=PL123", "YouTube", "playlist"],
      ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "YouTube Music", "track"],
      ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "Spotify", "track"],
      ["https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3", "Spotify", "album"],
      ["https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk", "Spotify", "episode"],
      ["https://soundcloud.com/artist/a-track", "SoundCloud", "track"],
      ["https://soundcloud.com/artist/sets/a-list", "SoundCloud", "playlist"],
      ["https://vimeo.com/76979871", "Vimeo", "video"],
    ];
    for (const [url, provider, kind] of cases) expect(detectMediaLink(url), url).toMatchObject({ provider, kind, url });
  });

  it("leaves other links, plain http and malformed ids alone", () => {
    for (const url of [
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/channel/UC123",
      "https://open.spotify.com/user/someone",
      "https://open.spotify.com/track/tooShort",
      "https://soundcloud.com/artist",
      "https://soundcloud.com/artist/likes",
      "https://vimeo.com/channels/staffpicks",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://example.com/watch?v=dQw4w9WgXcQ",
    ])
      expect(detectMediaLink(url), url).toBeNull();
  });

  it("finds the first music or video link in a message", () => {
    expect(findMediaLink("see https://example.com and https://youtu.be/dQw4w9WgXcQ, then https://vimeo.com/76979871")).toMatchObject({ provider: "YouTube", url: "https://youtu.be/dQw4w9WgXcQ" });
    expect(findMediaLink("nothing to see here")).toBeNull();
  });
});

describe("albums (android Album)", () => {
  it("lays out two, three and four or more photos, the last tile counting the rest", async () => {
    const { albumOverflow, albumRows } = await import("../src/ui/chat/album");
    expect(albumRows(0)).toEqual([]);
    expect(albumRows(2)).toEqual([[0, 1]]);
    expect(albumRows(3)).toEqual([[0], [1, 2]]);
    expect(albumRows(7)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(albumOverflow(4)).toBe(0);
    expect(albumOverflow(10)).toBe(6);
  });
});
