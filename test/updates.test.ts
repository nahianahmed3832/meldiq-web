import { describe, expect, it } from "vitest";
import { buildIdOf, isStaleChunkError } from "../src/application/updates";

describe("new releases", () => {
  it("reads the build id from a page of this app", () => {
    expect(buildIdOf('<script id="__NEXT_DATA__" type="application/json">{"props":{},"page":"/","buildId":"OAcqnhfuUrk5e6qwiPiAg","nextExport":true}</script>')).toBe("OAcqnhfuUrk5e6qwiPiAg");
  });

  it("has no build id for a development server or another page", () => {
    expect(buildIdOf('{"buildId":"development"}')).toBeNull();
    expect(buildIdOf("<html><body>502 Bad Gateway</body></html>")).toBeNull();
  });

  it("recognises a screen of an older release that's no longer on the server", () => {
    expect(isStaleChunkError(Object.assign(new Error("Loading chunk 123 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://web.meldiq.app/_next/static/chunks/a.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isStaleChunkError(new Error("Couldn't load your conversations."))).toBe(false);
    expect(isStaleChunkError("nope")).toBe(false);
  });
});
