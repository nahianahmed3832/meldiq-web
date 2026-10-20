import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { networkAddress } from "../src/sync/account";
import type { Engine } from "../src/sync/engine";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";

/** Your Meldiq network address (android Settings › address), from a server that federates, and none where it doesn't. */
let server: Server;
let plain: Server;
let ann: Phone;
let web: Engine;
let plainWeb: Engine;

beforeAll(async () => {
  server = await startServer({ FEDERATION_DOMAIN: "a.meldiq.test", FEDERATION_PUBLIC_URL: "http://a.meldiq.test", FEDERATION_ALLOW_HTTP: "true" });
  ann = await server.client("ann", "Ann");
  web = (await linkBrowser(server, ann)).engine;
  plain = await startServer();
  plainWeb = (await linkBrowser(plain, await plain.client("bo", "Bo"))).engine;
});
afterAll(async () => {
  web?.stop();
  plainWeb?.stop();
  await server?.close();
  await plain?.close();
});

describe("network address", () => {
  it("is your username at this server's domain where the server federates, and absent otherwise", async () => {
    expect(web.state.get().server?.federation?.domain).toBe("a.meldiq.test");
    const address = await networkAddress(web);
    expect(address).toMatch(/^@ann/);
    expect(address).toContain("a.meldiq.test");
    expect(await networkAddress(plainWeb)).toBeNull();
  });
});
