---
id: e6830624-6920-71a6-9b67-d5f89d9366b8
key: topic:system-design/caching
subject: system-design
topic: caching
title: Caching Deep-Dive
slug: caching-deep-dive
order: 1
---

Comprehensive master guide to caching strategies, Redis eviction policies, consistent hashing, cache stampede mitigations, and distributed Redis cluster topology.

# Cache Strategies &amp; Design Patterns

> [!NOTE] Cache-Aside (Lazy Loading)
>
> App checks cache first. On miss, app fetches from DB, populates cache, and returns data. <strong>Resilient to cache outages</strong>, but cache misses incur 3 network round-trips.

> [!NOTE] Read-Through
>
> App interacts only with Cache abstraction layer. On cache miss, the Cache library automatically fetches from DB, populates itself, and returns data to App.

> [!NOTE] Write-Through
>
> App writes to Cache. Cache synchronously updates DB before returning success. Guarantees cache consistency, but increases write latency.

> [!NOTE] Write-Behind (Write-Back)
>
> App writes to Cache immediately. Cache asynchronously batches and flushes writes to DB in background. Ultra-low write latency, but <strong>risk of data loss</strong> if cache node crashes before DB sync.

# Redis Eviction Policies

# Redis `maxmemory-policy` Settings

| Policy | Scope | Behavior |
| --- | --- | --- |
| `noeviction` | All Keys | Returns error on writes when memory limit reached. Best for critical caches. |
| `allkeys-lru` | All Keys | Evicts Least Recently Used keys across entire dataset. (Most popular choice). |
| `volatile-lru` | Keys with TTL | Evicts Least Recently Used keys among keys configured with expiration TTL. |
| `allkeys-lfu` | All Keys | Evicts Least Frequently Used keys using logarithmic access counters. |
| `volatile-ttl` | Keys with TTL | Evicts keys with the shortest remaining Time-To-Live. |

# Cache Stampede &amp; Hot Key Mitigation

> [!NOTE] Cache Stampede (Thundering Herd)
>
> Occurs when a popular cached key expires, causing thousands of concurrent requests to hit the DB simultaneously.<br><br> • <strong>Mutex / Distributed Locking:</strong> First thread acquires lock, populates cache; remaining threads wait.<br> • <strong>Probabilistic Early Expiration (XFetch Algorithm):</strong> Recomputes key early if `currentTime - (beta * delta * ln(rnd)) > TTL`.

> [!NOTE] Hot Key Bottleneck
>
> Single key receives millions of requests/sec overloading a single cache node.<br><br> • <strong>L1 Local Memory Cache:</strong> In-process cache (Guava/Caffeine) on application servers.<br> • <strong>Key Sharding / Random Suffix:</strong> Replicate key as `item_key_1`...`item_key_N` across nodes.

# Redis Cluster vs Redis Sentinel

> [!NOTE] Redis Sentinel
>
> High availability solution for single-master topologies. Sentinels monitor primary, trigger automated failover to replica if primary dies, and notify app clients.

> [!NOTE] Redis Cluster
>
> Distributed horizontal scaling solution. Divides key space into <strong>16,384 Hash Slots</strong> assigned across master nodes using CRC16: `slot = CRC16(key) mod 16384`.
