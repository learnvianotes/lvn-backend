---
id: 3d0211d9-62d1-7a6c-aa55-e7892a2abd7c
key: topic:sql/locking-concurrency
subject: sql
topic: locking-concurrency
title: Locking, MVCC & Deadlocks
slug: locking-mvcc-deadlocks
order: 1
---

Databases coordinate concurrent transactions with <strong>locks</strong> and, in most modern engines, <strong>MVCC</strong> (multi-version concurrency control), so readers and writers rarely block each other.

# Lock types

| Lock | Taken by | Compatible with |
| --- | --- | --- |
| Shared (S) | Reads that need stability (`FOR SHARE`, lock-based engines) | Other shared locks |
| Exclusive (X) | `INSERT`/`UPDATE`/`DELETE`, `SELECT … FOR UPDATE` | Nothing — others wait |
| Intent (IS/IX) | Table-level marker before row locks | Lets the engine check table locks cheaply |

Granularity: <strong>row</strong> locks (InnoDB, PostgreSQL, SQL Server, Oracle) allow high concurrency; <strong>table/page</strong> locks are cheaper but block more; SQLite locks the <strong>whole database</strong> for writing.

# MVCC

Instead of overwriting a row in place, an update creates a <strong>new version</strong>. Each transaction reads the versions that were committed as of its snapshot. Result: <em>readers don't block writers and writers don't block readers</em>; only writer-vs-writer on the same row waits.

- PostgreSQL keeps old versions in the table (cleaned up by `VACUUM`).
- MySQL InnoDB and Oracle rebuild old versions from undo logs.
- SQL Server uses locking by default; `READ_COMMITTED_SNAPSHOT` switches reads to row versions.

# Explicit row locks

```sql filename:PostgreSQL%20%2F%20MySQL%208%20%2F%20Oracle
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;       -- lock the row; others' FOR UPDATE waits
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;

-- job queues: grab the next free job without waiting on rows others locked
SELECT id FROM jobs WHERE status = 'new'
ORDER BY id LIMIT 1
FOR UPDATE SKIP LOCKED;
```

# Deadlocks

1. <strong>T1</strong>

   Locks account 1 (`UPDATE … WHERE id = 1`).

2. <strong>T2</strong>

   Locks account 2 (`UPDATE … WHERE id = 2`).

3. <strong>T1</strong>

   Wants account 2 → waits for T2.

4. <strong>T2</strong>

   Wants account 1 → waits for T1. Neither can proceed.

5. <strong>Database</strong>

   Detects the cycle and aborts one transaction (the <em>victim</em>) with a deadlock error; the other continues.

> [!TIP] Do
>
> Access rows in a consistent order (e.g. always the lower account id first), keep transactions short, index the columns in `WHERE` so fewer rows are locked, and retry on deadlock errors.

> [!DANGER] Avoid
>
> Hold a transaction open while waiting for user input or a slow API call.

# SQLite: one writer at a time

```python filename:Python%20%2B%20SQLite%20%E2%80%94%20write%20lock
import os, sqlite3, tempfile

path = os.path.join(tempfile.mkdtemp(), "shop.db")
with sqlite3.connect(path) as db:
    db.execute("PRAGMA journal_mode = WAL")
    db.execute("CREATE TABLE stock (sku TEXT PRIMARY KEY, qty INTEGER)")
    db.execute("INSERT INTO stock VALUES ('PEN', 10)")

a = sqlite3.connect(path, isolation_level=None, timeout=0)
b = sqlite3.connect(path, isolation_level=None, timeout=0)

a.execute("BEGIN IMMEDIATE")                        # A holds the write lock
a.execute("UPDATE stock SET qty = qty - 1 WHERE sku = 'PEN'")
try:
    b.execute("UPDATE stock SET qty = qty - 1 WHERE sku = 'PEN'")
except sqlite3.OperationalError as e:
    print("B:", e)                                  # B: database is locked
print("B can still read:", b.execute("SELECT qty FROM stock").fetchone()[0])   # B can still read: 10
a.execute("COMMIT")
b.execute("UPDATE stock SET qty = qty - 1 WHERE sku = 'PEN'")   # now it succeeds
print("final:", b.execute("SELECT qty FROM stock").fetchone()[0])              # final: 8
```

Real apps set a `timeout` (busy timeout) so the second writer waits instead of failing immediately.

```question
What is a deadlock and how do databases handle it?

---

Two (or more) transactions each hold a lock the other needs, so all wait forever. The engine's deadlock detector finds the cycle and rolls back one victim, returning an error (MySQL 1213, SQL Server 1205, PostgreSQL 40P01). Prevent with consistent lock ordering and short transactions; handle by retrying.
```

```question
Optimistic vs pessimistic locking?

---

Pessimistic: lock the data before changing it (`SELECT … FOR UPDATE`), so conflicts wait — good for high contention. Optimistic: don't lock; detect a conflict at write time with a version/timestamp column (`WHERE version = :v`) and retry — good when conflicts are rare, e.g. web forms.
```
