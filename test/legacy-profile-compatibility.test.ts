import { expect, it } from "vitest";
import { zProfileStyle as releasedProfileStyle } from "./support/legacy-web-426/profileSchemas";
import { readCopy } from "./support/contracts";

it("the deployed web reader keeps legacy fallbacks when a profile contains collectible descriptors", () => {
  const response = readCopy<{ profileStyle: Record<string, unknown> }>("http/PATCH_v2_users_me_profile-customization.json");
  expect(response.profileStyle.collectibles).toBeInstanceOf(Array);
  const legacy = releasedProfileStyle.parse(response.profileStyle);
  expect(legacy).not.toBeNull();
  expect(legacy).not.toHaveProperty("collectibles");
  expect(legacy?.decoration).toBe(response.profileStyle.decoration);
  expect(legacy?.accent).toBe(response.profileStyle.accent);
  expect(legacy?.nameFont).toBe(response.profileStyle.nameFont);
});
