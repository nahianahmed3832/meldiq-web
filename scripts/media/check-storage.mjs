/** Read-only S3 release check. Run with the server's SDK dependencies; never prints signed URLs or credentials. */
import { createRequire } from "node:module";
import path from "node:path";
const server = process.env.MELDIQ_SERVER_DIR;
if (!server || !process.env.S3_BUCKET || !process.env.S3_REGION || !process.env.MELDIQ_MEDIA_ORIGIN) {
  throw new Error("Set MELDIQ_SERVER_DIR, S3_BUCKET, S3_REGION and MELDIQ_MEDIA_ORIGIN. This check only reads bucket configuration.");
}
const require = createRequire(path.resolve(server, "package.json"));
const { S3Client, GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketCorsCommand, GetBucketLifecycleConfigurationCommand } = require("@aws-sdk/client-s3");
const origin = new URL(process.env.MELDIQ_MEDIA_ORIGIN).origin;
const client = new S3Client({
  region: process.env.S3_REGION,
  maxAttempts: 2,
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } } : {}),
});
const commands = [GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketCorsCommand, GetBucketLifecycleConfigurationCommand];
const results = await Promise.allSettled(commands.map((Command) => client.send(new Command({ Bucket: process.env.S3_BUCKET }))));
const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });
for (let i = 0; i < results.length; i++) if (results[i].status === "rejected") add(commands[i].name, false, results[i].reason?.name ?? "Request failed");
const value = (index) => (results[index].status === "fulfilled" ? results[index].value : null);
const publicAccess = value(0)?.PublicAccessBlockConfiguration;
if (publicAccess)
  add(
    "private bucket",
    ["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"].every((key) => publicAccess[key] === true),
    "All four public access blocks should be enabled.",
  );
const encryption = value(1)?.ServerSideEncryptionConfiguration?.Rules ?? [];
add(
  "encryption at rest",
  encryption.some((r) => ["AES256", "aws:kms"].includes(r.ApplyServerSideEncryptionByDefault?.SSEAlgorithm)),
  "SSE-S3 or SSE-KMS in addition to encrypted attachment bytes.",
);
const cors = (value(2)?.CORSRules ?? []).filter((r) => r.AllowedOrigins?.includes(origin));
const allowsHeader = (header) =>
  cors.some((r) => r.AllowedHeaders?.some((pattern) => pattern === "*" || (pattern.endsWith("*") ? header.startsWith(pattern.toLowerCase().slice(0, -1)) : header === pattern.toLowerCase())));
add(
  "origin upload/download methods",
  ["GET", "PUT"].every((method) => cors.some((r) => r.AllowedMethods?.includes(method))),
  "Allow GET and PUT for the exact Web origin.",
);
add("signed upload headers", ["content-type", "x-amz-checksum-sha256", "if-none-match"].every(allowsHeader), "CORS must permit signed checksum and conditional upload headers.");
add(
  "resumable download headers",
  cors.some((r) => r.ExposeHeaders?.some((h) => h.toLowerCase() === "content-range" || h === "*")),
  "Expose Content-Range so Web can validate resumed responses.",
);
const rules = value(3)?.Rules ?? [];
const attachmentPrefix = `${process.env.S3_PREFIX ?? "orbit/"}attachments/`;
add(
  "multipart lifecycle",
  rules.some((r) => {
    const filter = r.Filter ?? {};
    const prefix = filter.Prefix ?? filter.And?.Prefix ?? r.Prefix ?? "";
    return !filter.Tag && !filter.And?.Tags?.length && attachmentPrefix.startsWith(prefix) && r.Status === "Enabled" && r.AbortIncompleteMultipartUpload?.DaysAfterInitiation > 0;
  }),
  "An enabled abort rule must cover the configured attachment prefix; review its filter.",
);
console.log(JSON.stringify({ readOnly: true, checks, passed: checks.every((check) => check.ok) }, null, 2));
client.destroy();
if (checks.some((check) => !check.ok)) process.exitCode = 1;
