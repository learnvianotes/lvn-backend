---
id: bc360275-95d1-724c-93db-48b16122351e
key: topic:system-design/dbinternals
subject: system-design
topic: dbinternals
title: DB Internals
slug: db-internals
order: 1
---

Under the hood mechanics of Multi-Version Concurrency Control, transaction isolation anomalies, 2PL, index types, deadlock detection, and cost-based query optimization.

# MVCC (Multi-Version Concurrency Control)

> [!INFO]
>
> <strong>MVCC Mechanics:</strong> Allows concurrent readers and writers without blocking each other ("Readers don't block Writers, Writers don't block Readers").<br><br> • <strong>Tuple Header Fields:</strong> Each row stores metadata fields: `xmin` (Transaction ID that created the tuple) and `xmax` (Transaction ID that deleted/overwrote the tuple).<br> • <strong>Read Views:</strong> When a transaction begins, it takes a snapshot view of active transactions. A tuple is visible only if `xmin` is committed and `xmax` is uncommitted or `> current_tx`.<br> • <strong>Undo Logs &amp; Vacuuming:</strong> Old tuple versions are retained in Undo Logs / Dead pages and asynchronously garbage collected by background Vacuum processes.

# Isolation Levels &amp; Anomalies Matrix

# ANSI SQL &amp; Snapshot Isolation Anomalies

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Write Skew |
| --- | --- | --- | --- | --- |
| <strong>Read Uncommitted</strong> | Allowed | Allowed | Allowed | Allowed |
| <strong>Read Committed</strong> | Prevented | Allowed | Allowed | Allowed |
| <strong>Repeatable Read</strong> | Prevented | Prevented | Allowed (SQL Standard) | Allowed |
| <strong>Snapshot Isolation</strong> | Prevented | Prevented | Prevented | Allowed |
| <strong>Serializable (SSI)</strong> | Prevented | Prevented | Prevented | Prevented |

# Locking &amp; Concurrency Control

> [!NOTE] Lock Types & Intent Locks
>
> • <strong>Shared (S):</strong> Read lock. Multiple transactions can hold S locks.<br> • <strong>Exclusive (X):</strong> Write lock. Only one transaction can hold X lock.<br> • <strong>Intent Locks (IS, IX, SIX):</strong> Placed at table level before acquiring row locks to prevent coarse-grained lock conflicts without scanning rows.

> [!NOTE] Two-Phase Locking (2PL)
>
> • <strong>Growing Phase:</strong> Transaction acquires locks, cannot release any.<br> • <strong>Shrinking Phase:</strong> Transaction releases locks, cannot acquire new ones.<br> • <strong>Strict 2PL:</strong> All exclusive locks held until transaction commits/aborts (prevents cascading rollbacks).

# Deadlock Detection &amp; Prevention

> [!NOTE] Wait-For Graph (WFG)
>
> Background thread periodically builds directed graph of transactions waiting for locks. A cycle indicates a deadlock. System selects a <strong>victim transaction</strong> and aborts it to break the cycle.

> [!NOTE] Wait-Die vs Wound-Wait
>
> • <strong>Wait-Die (Non-preemptive):</strong> Older Tx waits for younger Tx; Younger Tx dies if requesting older lock.<br> • <strong>Wound-Wait (Preemptive):</strong> Older Tx preempts ("wounds") younger Tx; Younger Tx waits for older Tx.

# Cost-Based Query Optimizer (CBO)

> [!INFO]
>
> <strong>CBO Execution Workflow:</strong> SQL Query → Parser (Abstract Syntax Tree) → Query Rewriter → Optimizer (Estimates I/O + CPU costs using column histograms/statistics) → Physical Execution Plan (Nested Loop Join vs Hash Join vs Merge Join).
