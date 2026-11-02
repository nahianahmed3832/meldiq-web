# Monitoring and cost guide

## Observed baseline and unknowns

Fresh Atlas inventory is in `docs/architecture/live-inventory-20261102.json`: 112,183,794 logical data bytes, 62,595,072 index bytes, 39,677,952 allocated collection bytes, 689,608 documents across264 collections. These are different storage measures and are not a PostgreSQL size estimate. The later admin inventory observes272 collections/689,860 documents,112,324,092 logical data bytes,39,694,336 allocated collection bytes and62,996,480 index bytes; neither is a frozen cutover snapshot. Both Supabase projects were observed on the Free organization; staging Nano/Frankfurt is new. Actual Hostinger/S3/LiveKit invoices, region-specific egress, API throughput and monthly active users were not supplied/verified. Total current monthly infrastructure cost therefore remains unknown.

## Illustrative scenarios, USD/month

Supabase's published Pro base is $25/month, with compute credits; Realtime includes5million messages, then $2.50/million. Three Micro projects with $10 compute each and one $10 credit would be approximately $45 before usage/add-ons. This is an assumption for production + staging + retained legacy Auth, not a chosen upgrade or quote. Local development adds no hosted compute. Keeping fewer hosted projects eventually reduces cost only after safe migration, never by deleting live Auth early.

| Scenario | Assumed Realtime messages/month | Illustrative Supabase base+Realtime | Excluded/unmeasured |
|---|---:|---:|---|
| Low | 2 million | $45 | Hostinger, S3, LiveKit, backup destination, egress/MAU/disk/peak-connection overages |
| Expected | 15 million | $70 | same; validate fan-out and connection peaks |
| Growth | 100 million | $282.50 | same; higher compute may be needed after measurement |

Do not mistake sender messages for billable fan-out. An event with100 recipients can generate approximately100 deliveries plus inbound/presence overhead. The budget model must include both active users and recipients/event. Cross-region backend↔database traffic and private media egress are independent of database size.

No paid upgrade, add-on, replica or subscription was enabled by this work. Verify the current [pricing](https://supabase.com/pricing), [billing allowances](https://supabase.com/docs/guides/platform/billing-on-supabase) and [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing) before approving spend. No full monthly saving is claimed.

## Required telemetry

Track database logical/disk/index bytes, growth/day, connections/active waits, query and transaction p50/p95, pool waiting/error counters, API status/latency, JWT failures by safe code, outbox oldest age/retry/dead counts, publisher/push latency, Realtime deliveries/connections/fan-out, MAU, PostgreSQL egress, S3 bytes/requests, orphan metadata and worker resource use. Use aggregate metrics; never include tokens, passwords, message text or raw personal identifiers as labels.

Apply quota alerts at **50%,70%,85%** for database budget, connection cap, monthly Realtime messages, MAU and egress. Escalate on a threshold crossing; avoid repeated unchanged notices. Treat outbox dead letters, backup failures, unauthorized RLS success and missing metadata as actionable regardless of percentage. Configure actual notification routing/owners before launch; rule files alone do not prove delivery.

Start provisional pools at API5 and worker2 connections, with explicit timeout and no client database connections. PostgresRows needs one reserved direct/session connection and one writer; transaction pooling cannot preserve that advisory lock. Measure max active/waiting utilization under staged concurrent workloads before tuning. Optimize indexes, batching, round trips and retention before compute upgrades. No premature partitioning or global replicas.

A bounded MacBook-to-Frankfurt sample now measures20 warm history HTTP reads at concurrency2, no errors, p50 1,414.43ms/p95 1,549.59ms; ten SELECT1 session-pooler round trips measured p50 324.08ms/p95 356.35ms. The actual outbox-to-two-private-socket receipt was2,093.59ms. Pool snapshot:3 total/2 idle/0 waiting/0 errors. These are small geographic measurements, not VPS capacity or launch SLOs. No real fan-out or monthly volume distribution is established.

Published plan, compute-credit and Realtime rates were rechecked against the linked official pages on November2,2026. The scenarios are assumptions, not an enabled plan or complete infrastructure quote.
