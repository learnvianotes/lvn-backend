---
id: f656ff13-7420-7f25-9038-97a4e04f17e3
key: topic:system-design/replication
subject: system-design
topic: replication
title: Replication
slug: replication
order: 1
---

Maintaining copies of data across multiple nodes for fault tolerance, read scaling, and geographic distribution.

# Definition

> [!INFO]
>
> <strong>Replication</strong> keeps identical copies of data on multiple servers. If one server fails, others serve requests. Also allows reads to be distributed across replicas for higher throughput.

# Replication Patterns

> [!NOTE] Primary-Replica (Master-Slave)
>
> All writes go to primary. Replicas sync async and serve reads. Simple, but primary is a SPOF. Failover requires promoting a replica.

> [!NOTE] Multi-Primary (Multi-Master)
>
> Multiple nodes accept writes. Higher availability but introduces write conflicts — requires conflict resolution strategy.

# Sync vs Async Replication

> [!NOTE] Synchronous
>
> Write doesn't return success until all replicas confirm. Zero data loss but higher latency. Used in financial systems.

> [!NOTE] Asynchronous
>
> Write returns immediately after primary confirms. Replicas catch up later. Low latency but potential data loss on primary crash.
