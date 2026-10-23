---
id: 76e63a4c-060c-7d8f-a17a-31b5e0b89205
key: topic:system-design/cap
subject: system-design
topic: cap
title: CAP Theorem
slug: cap-theorem
order: 1
---

In any distributed system, you can guarantee at most 2 of 3: Consistency, Availability, Partition Tolerance.

> [!INFO]
>
> Eric Brewer's CAP theorem (2000): a distributed data store can only guarantee two of the three properties simultaneously. Since network partitions are inevitable in real distributed systems, you are always effectively choosing between <strong>Consistency</strong> and <strong>Availability</strong> during a partition.

> [!NOTE] Consistency
>
> Every read receives the most recent write or an error. All nodes see the same data at the same time.

> [!NOTE] Availability
>
> Every request receives a response — not necessarily the latest data. The system stays up even when some nodes fail.

> [!NOTE] Partition Tolerance
>
> The system operates even when network messages between nodes are dropped. Required in all real distributed systems.

# CP vs AP — The Real Choice

> [!NOTE] CP Systems
>
> Return errors during network partitions rather than stale data. Strong consistency guaranteed.<br><br><strong>Examples:</strong> HBase, ZooKeeper, MongoDB (default), etcd, Redis (single master)<br><br><strong>Use when:</strong> Financial transactions, inventory management, anything where stale data causes real harm.

> [!NOTE] AP Systems
>
> Return potentially stale data during partitions but never return errors. Eventual consistency.<br><br><strong>Examples:</strong> Cassandra, DynamoDB, CouchDB, DNS<br><br><strong>Use when:</strong> Social feeds, product catalogs, user profiles — anything tolerant of momentary staleness.

# ACID vs BASE

> [!NOTE] ACID (SQL Databases)
>
> <strong>Atomicity</strong> — all or nothing<br><strong>Consistency</strong> — valid state before and after every transaction<br><strong>Isolation</strong> — concurrent transactions don't interfere<br><strong>Durability</strong> — committed data survives crashes

> [!NOTE] BASE (NoSQL Databases)
>
> <strong>Basically Available</strong> — system is available most of the time<br><strong>Soft state</strong> — state may change without input (replication lag)<br><strong>Eventual consistency</strong> — data will converge to consistency eventually

# 2-Phase Commit (2PC)

> [!INFO]
>
> Distributed transaction protocol. <strong>Phase 1 (Prepare):</strong> coordinator sends PREPARE to all nodes; nodes lock resources and reply OK. <strong>Phase 2 (Commit):</strong> if all replied OK, coordinator sends COMMIT; nodes commit and release locks. If any node fails in Phase 1, coordinator sends ROLLBACK. <strong>Problem:</strong> coordinator is a SPOF; protocol blocks if coordinator crashes after Phase 1 but before Phase 2.
