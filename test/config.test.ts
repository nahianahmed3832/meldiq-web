import { describe, expect, it } from "vitest";
import { apiBase, config, loadConfig, serverHost, wsUrl } from "../src/app/config";

const serve = (body: unknown, type = "application/json") => (async () => new Response(JSON.stringify(body), { headers: { "content-type": type } })) as typeof fetch;

describe("runtime configuration (/config.json)", () => {
  it("defaults to same-origin when there's no file", async () => {
    await loadConfig((async () => new Response("not found", { status: 404 })) as typeof fetch);
    expect(config()).toMatchObject({ apiBase: "", wsUrl: null, environment: "production" });
    expect(apiBase()).toBe("");
  });

  it("points at another API origin and derives the WebSocket from it", async () => {
    await loadConfig(serve({ apiBase: "https://msg.griipbuddy.cloud/", publicUrl: "https://web.griipbuddy.cloud" }));
    expect(apiBase()).toBe("https://msg.griipbuddy.cloud");
    expect(wsUrl()).toBe("wss://msg.griipbuddy.cloud/v1/ws");
    expect(serverHost()).toBe("msg.griipbuddy.cloud");
    await loadConfig(serve({ apiBase: "https://api.example.test", wsUrl: "wss://rt.example.test/v1/ws" }));
    expect(wsUrl()).toBe("wss://rt.example.test/v1/ws");
  });

  it("refuses insecure or odd addresses instead of talking to the wrong server", async () => {
    await expect(loadConfig(serve({ apiBase: "http://msg.griipbuddy.cloud" }))).rejects.toThrow(/https/);
    await expect(loadConfig(serve({ apiBase: "https://msg.griipbuddy.cloud/api" }))).rejects.toThrow();
    await expect(loadConfig(serve({ wsUrl: "ws://msg.griipbuddy.cloud/v1/ws" }))).rejects.toThrow(/wss/);
    await expect(loadConfig(serve({ environment: "prod" }))).rejects.toThrow();
    // Local development may use plain http on localhost.
    await loadConfig(serve({ apiBase: "http://localhost:8080", wsUrl: "ws://localhost:8080/v1/ws", environment: "development" }));
    expect(wsUrl()).toBe("ws://localhost:8080/v1/ws");
  });

  it("ignores an HTML page served in place of the file (an SPA fallback)", async () => {
    await loadConfig(serve("<html>", "text/html"));
    expect(apiBase()).toBe("");
  });

  it("takes the Firebase web settings for background notifications, and refuses an Android app id", async () => {
    const firebase = { apiKey: "AIzaSyTestKeyForUnitTests000", projectId: "meldiq", messagingSenderId: "123456789012", appId: "1:123456789012:web:0a1b2c3d4e5f", vapidKey: "B".repeat(87) };
    await loadConfig(serve({ firebase }));
    expect(config().firebase).toEqual(firebase);
    await loadConfig(serve({}));
    expect(config().firebase).toBeNull();
    await expect(loadConfig(serve({ firebase: { ...firebase, appId: "1:123456789012:android:0a1b2c3d4e5f" } }))).rejects.toThrow(/web app/);
  });
});
