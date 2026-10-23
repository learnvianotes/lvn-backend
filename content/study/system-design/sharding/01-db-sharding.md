---
id: d7ed0258-0710-73ad-b9c1-376992d2842b
key: topic:system-design/sharding
subject: system-design
topic: sharding
title: DB Sharding
slug: db-sharding
order: 1
---

Horizontally partitioning a database into smaller, independent pieces (shards) each stored on a separate server.

# Definition

> [!INFO]
>
> <strong>Sharding</strong> splits a large database into smaller shards, each responsible for a subset of data. Each shard is an independent database that can be queried independently. Enables horizontal scaling of databases beyond what any single machine can handle.

# Sharding Strategies

> [!NOTE] Hash-Based Sharding
>
> Hash the shard key (e.g., user\_id % N). Even distribution but makes range queries hard and resharding painful.

> [!NOTE] Range-Based Sharding
>
> Shard by key ranges (A-M, N-Z). Easy range queries but can create hotspots if data isn't uniformly distributed.

> [!NOTE] Geographic Sharding
>
> Shard by user region. Keeps data close to users, helps with data residency regulations.

> [!NOTE] Directory-Based Sharding
>
> A lookup table maps keys to shards. Flexible but the lookup table becomes a bottleneck and SPOF.

> [!WARNING]
>
> ⚠️ <strong>Hotspot Problem:</strong> If one shard gets disproportionate traffic (celebrity user, trending content), it becomes overloaded. Mitigate with consistent hashing, virtual nodes, or application-level load awareness.
