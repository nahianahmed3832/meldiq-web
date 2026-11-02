import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StyledAvatar } from "../src/ui/people/ProfileStyle";

vi.mock("../src/application/prefs", () => ({ usePrefs: () => ({ reducedMotion: "off" }) }));
vi.mock("../src/ui/components/photos", () => ({ usePhoto: () => null }));

const avatar = { userId: "test", name: "Explorer", colorIndex: 0, photoRev: null, media: null, decoration: "sakura", size: 40 };

describe("presence above avatar artwork", () => {
  it.each([false, true])("keeps idle presence for animated=%s and places it after the decoration", (animated) => {
    const html = renderToStaticMarkup(<StyledAvatar {...avatar} online presence="idle" previewUrl={animated ? { url: "/animated.webp", video: false } : null} />);
    expect(html).toContain('aria-label="Idle"');
    expect(html.match(/class="presence/g)).toHaveLength(1);
    expect(html.lastIndexOf('class="presence')).toBeGreaterThan(html.indexOf("avatar-frame-art"));
    if (animated) expect(html).toContain('src="/animated.webp"');
  });

  it("keeps offline and hidden presence distinct", () => {
    expect(renderToStaticMarkup(<StyledAvatar {...avatar} online={false} />)).toContain('aria-label="Offline"');
    expect(renderToStaticMarkup(<StyledAvatar {...avatar} online={null} />)).not.toContain('class="presence');
  });
});
