import type { Engine } from "./engine";

export interface ComponentSubmission {
  channelId: string;
  botId: string;
  messageId: string;
  customId: string;
  interactionId: string;
  values?: string[];
  fields?: Record<string, string>;
}
/** Uses the native human interaction route; bot credentials never enter the browser. */
export async function submitBotComponent(engine: Engine, body: ComponentSubmission): Promise<void> {
  await engine.api.call("POST", "/v2/interactions", { body: { ...body, kind: "component" } });
}
