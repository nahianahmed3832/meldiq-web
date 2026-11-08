import { z } from "zod";
import type { ApiClient } from "../api/client";

const path = "/v2/me/saved-collections";
const response = z.object({
  collections: z.array(z.object({ id: z.string(), name: z.string(), messageIds: z.array(z.string()) })).max(20),
});
export type SavedCollection = z.infer<typeof response>["collections"][number];
export type CollectionOp = { op: "create" | "rename"; id: string; name: string } | { op: "delete"; id: string } | { op: "add" | "remove"; id: string; messageId: string };

export async function getSavedCollections(api: ApiClient) {
  return (await api.json("GET", path, response)).collections;
}

export async function updateSavedCollection(api: ApiClient, body: CollectionOp) {
  return (await api.json("POST", path, response, { body })).collections;
}
