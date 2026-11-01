# Rollback compatibility assessment

Source reviewed: migration fallback `c87a8e58`, profile candidate `70eb0272`. This is a source-based assessment; no production records were altered to simulate a rollback.

The old all-16-domain Atlas image is **unsuitable for normal traffic after collectible state is written**. Keep it behind maintenance until a compatible fix is ready. Preserve all 16 Atlas authorities; never restore SQLite authority after accepting Atlas writes.

| Fallback source | Consequence |
|---|---|
| `server/src/modules/accounts/profileMedia.ts:40` | `styleOf` returns an explicit legacy shape. Reads show the saved fallback frame/colors without modifying stored JSON, but omit `collectibles`. |
| `server/src/modules/accounts/profileMediaRoutes.ts:268` | A legacy style edit constructs that legacy shape and serializes it at line284, dropping saved collectible descriptors. Ownership records are separate, but equipped state would be lost. |
| `server/src/modules/accounts/decorations/service.ts:264` | Decoration takedown also serializes `styleOf`, so it can drop unrelated collectible descriptors. |
| `server/src/infrastructure/database/mongo/client.ts:7` and `:88` | The fallback advertises schema version4 and replaces the schema catalog metadata with its older table list. It does not implement the five new identity collections/cascade metadata. User deletion therefore cannot be assumed to clean their associated records correctly. This cascade concern is inferred from the missing schema metadata, not verified by a production deletion. |
| `server/src/admin.ts:759` | The old `storage-orphans --delete` lacks registered collectible asset/staging references. It must not be used against the new asset store. |

Client-only rollback while retaining the compatible 0.75 API and updated maintenance CLI preserves ownership, recipes, assets and schema5. If the API itself needs replacement, use a compatible forward fix or remain in maintenance while restoring service. No collection, ownership transaction, original asset or sealing key should be deleted as a rollback step.
