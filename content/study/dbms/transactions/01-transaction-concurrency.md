---
id: 3506e364-58d6-701f-b5c0-f910f1cad42b
key: topic:dbms/transactions
subject: dbms
topic: transactions
title: Transaction & Concurrency
slug: transaction-concurrency
order: 1
---

A transaction is a logical unit of work. To maintain database consistency, transactions must adhere to ACID properties, and concurrent operations must be serializable.

# ACID vs BASE

### ACID (Strict Consistency)

> [!TIP]
>
> <strong>ACID Properties:</strong> <br>• <strong>Atomicity:</strong> All-or-nothing execution. Rollback on failure. (Managed by <em>Transaction Manager</em>) <br>• <strong>Consistency:</strong> The database transitions only between valid states conforming to rules. (Managed by <em>Application Programmer</em>) <br>• <strong>Isolation:</strong> Concurrent transactions run independently without interference. (Managed by <em>Concurrency Control Manager</em>) <br>• <strong>Durability:</strong> Once committed, changes survive system crashes. (Managed by <em>Recovery Manager</em>)

### BASE (Eventual Consistency)

> [!WARNING]
>
> <strong>BASE Model (NoSQL systems):</strong> <br>• <strong>Basically Available:</strong> The system responds to requests, even if some nodes are down. <br>• <strong>Soft State:</strong> The state of the data can drift or change over time without user interaction. <br>• <strong>Eventual Consistency:</strong> Data copies across global servers will sync up and become identical over time.

# CAP Theorem

> [!INFO]
>
> States that a distributed data store can simultaneously provide at most two of the following three guarantees: <br>1. <strong>Consistency (C):</strong> Every read receives the most recent write or an error. <br>2. <strong>Availability (A):</strong> Every non-failing node returns a response for every request. <br>3. <strong>Partition Tolerance (P):</strong> The system continues to operate despite arbitrary communication network splits. <br><strong>Tradeoff:</strong> When a network partition (P) occurs, a database must choose either Consistency (CP) or Availability (AP).

# Concurrency Problems

> [!NOTE] Dirty Read
>
> Transaction T1 reads data modified by T2. T2 then aborts and rolls back, leaving T1 with invalid, uncommitted data.

> [!NOTE] Lost Update
>
> T1 and T2 read the same value, modify it independently, and write it back. One update overwrites the other.

> [!NOTE] Non-Repeatable Read
>
> T1 reads a value. T2 updates that value and commits. T1 reads the value again and gets a different result.

# Schedules &amp; Serializability

<strong>Serial Schedule:</strong> Transactions execute one after another without interleaving. Always consistent. · <strong>Non-Serial Schedule:</strong> Operations interleave. Improves performance but can lead to conflicts. · <strong>Conflict Serializable:</strong> A schedule that can be transformed into a serial schedule by swapping non-conflicting adjacent operations. · <strong>View Serializable:</strong> A weaker check than conflict serializability, verifying identical read/write flow states.

# Recoverability of Schedules

1. <strong>Recoverable Schedule</strong>

   T2 reads a value written by T1. T2 commits only <em>after</em> T1 commits. If T1 aborts, T2 can also safely abort.

2. <strong>Cascadeless Schedule</strong>

   T2 is only allowed to read values written by T1 <em>after</em> T1 has committed. Prevents cascading rollbacks where one transaction failure forces aborting multiple active ones.

3. <strong>Strict Schedule</strong>

   A transaction cannot read <em>or write</em> a data item written by another transaction until that transaction has committed or aborted. Prevents dirty writes.

# Concurrency Protocols

### Two-Phase Locking (2PL)

> [!NOTE] Two-Phase Locking (2PL) Rules
>
> Guarantees conflict serializability but does not prevent deadlocks:
>
> - <strong>Growing Phase:</strong> Transaction can acquire locks but cannot release any.
> - <strong>Shrinking Phase:</strong> Transaction can release locks but cannot acquire new ones.
> - <strong>Strict 2PL:</strong> All exclusive (X) locks held by a transaction must be kept until the transaction commits.

### Multiple Granularity Locking (MGL)

> [!NOTE] Multiple Granularity Compatibility Matrix
>
> Introduces Intention Locks to allow locking entire folders or individual records without parsing every child node:
>
> <strong>Lock Mode</strong> | <strong>IS</strong> | <strong>IX</strong> | <strong>S</strong> | <strong>SIX</strong> | <strong>X</strong>
>
> <strong>IS</strong> (Intention Shared) | OK | OK | OK | OK | Conflict
>
> <strong>IX</strong> (Intention Exclusive) | OK | OK | Conflict | Conflict | Conflict
>
> <strong>S</strong> (Shared) | OK | Conflict | OK | Conflict | Conflict
>
> <strong>SIX</strong> (Shared Intention Excl) | OK | Conflict | Conflict | Conflict | Conflict
>
> <strong>X</strong> (Exclusive) | Conflict | Conflict | Conflict | Conflict | Conflict

# Database Recovery Techniques

> [!NOTE] Log-Based Recovery
>
> Uses a sequential write-ahead log file to recover data:
>
> - <strong>Deferred Update (No-Undo/Redo):</strong> Changes written to disk only after commit. On failure, apply REDO. No UNDO is ever needed.
> - <strong>Immediate Update (Undo/Redo):</strong> Changes can be written to disk before commit. On failure, apply UNDO for uncommitted, and REDO for committed transactions.

> [!NOTE] Shadow Paging
>
> Alternative recovery scheme that avoids logs. Keeps two page tables: a <strong>Current Page Table</strong> and a <strong>Shadow Page Table</strong>. On commit, the current pointer overwrites the shadow pointer.

# Deadlock Prevention Schemes

### Wait-Die Scheme

> [!WARNING]
>
> <strong>Wait-Die Scheme (Non-preemptive):</strong> <br>• If an older transaction requests a resource held by a younger one, the older is allowed to <strong>wait</strong>. <br>• If a younger transaction requests a resource held by an older one, the younger is killed (<strong>dies</strong>) and restarted.

### Wound-Wait Scheme

> [!TIP]
>
> <strong>Wound-Wait Scheme (Preemptive):</strong> <br>• If an older transaction requests a resource held by a younger one, the older pre-empts (<strong>wounds</strong>) the younger, forcing it to abort and roll back. <br>• If a younger transaction requests a resource held by an older one, the younger is allowed to <strong>wait</strong>.
