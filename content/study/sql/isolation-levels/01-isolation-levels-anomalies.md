---
id: d4100a17-1457-70ff-9a45-b62073e0ed92
key: topic:sql/isolation-levels
subject: sql
topic: isolation-levels
title: Isolation Levels & Anomalies
slug: isolation-levels-anomalies
order: 1
---

Full isolation is expensive, so SQL defines four levels that trade correctness for concurrency. Each level forbids a different set of <strong>anomalies</strong>.

# The anomalies

| Anomaly | What happens | Example |
| --- | --- | --- |
| <strong>Dirty read</strong> | T2 reads data T1 has written but not committed | T1 debits 200, T2 reads 800, T1 rolls back — T2 used a value that never existed |
| <strong>Non-repeatable read</strong> | T1 reads a row twice and gets different values because T2 committed an update in between | Balance 1000, then 800 in the same report |
| <strong>Phantom read</strong> | T1 re-runs a range query and sees new/removed rows committed by T2 | `COUNT(*) WHERE dept_id = 1` is 4, then 5 |
| <strong>Lost update</strong> | T1 and T2 both read 1000, both write back their own result — one update disappears | Two withdrawals of 100 leave 900 instead of 800 |
| <strong>Write skew</strong> | Two transactions each check a condition, then write different rows, together breaking the rule | Two on-call doctors each go off duty because “the other is on call” |

# The four standard levels

| Level | Dirty read | Non-repeatable read | Phantom | Notes |
| --- | --- | --- | --- | --- |
| `READ UNCOMMITTED` | Possible | Possible | Possible | Rarely used; PostgreSQL treats it as Read Committed |
| `READ COMMITTED` | No | Possible | Possible | <strong>Default</strong> in PostgreSQL, SQL Server, Oracle |
| `REPEATABLE READ` | No | No | Possible (standard) — prevented by snapshots in PostgreSQL/MySQL | <strong>Default</strong> in MySQL InnoDB |
| `SERIALIZABLE` | No | No | No | As if transactions ran one at a time; may abort with serialization errors — retry |

```sql filename:PostgreSQL%20%2F%20MySQL%20%2F%20SQL%20Server
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;     -- SQL Server / MySQL (next transaction)
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;      -- PostgreSQL
```

# Seeing it: two sessions on one SQLite file

SQLite in WAL mode gives each reading transaction a <strong>snapshot</strong> (like Repeatable Read/Serializable) and allows one writer at a time. Two connections play two users:

```python filename:Python%20%2B%20SQLite%20%E2%80%94%20isolation
import os, sqlite3, tempfile

path = os.path.join(tempfile.mkdtemp(), "bank.db")
with sqlite3.connect(path) as db:
    db.execute("PRAGMA journal_mode = WAL")
    db.executescript("CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER);"
                     "INSERT INTO accounts VALUES (1, 1000);")

a = sqlite3.connect(path, isolation_level=None, timeout=0)   # session A
b = sqlite3.connect(path, isolation_level=None, timeout=0)   # session B
read = lambda s: s.execute("SELECT balance FROM accounts WHERE id = 1").fetchone()[0]

b.execute("BEGIN")                  # B starts a read transaction…
print("B first read:", read(b))     # B first read: 1000

a.execute("BEGIN IMMEDIATE")        # A takes the write lock
a.execute("UPDATE accounts SET balance = balance - 200 WHERE id = 1")
print("A sees its change:", read(a))       # A sees its change: 800
print("B, A uncommitted:", read(b))        # B, A uncommitted: 1000   ← no dirty read
a.execute("COMMIT")

print("B, A committed:", read(b))          # B, A committed: 1000     ← same snapshot: repeatable read
b.execute("COMMIT")
print("B, new transaction:", read(b))      # B, new transaction: 800
```

> [!NOTE] Key point
>
> Under `READ COMMITTED` (PostgreSQL's default), B's third read would already return 800 — each <em>statement</em> sees the latest committed data. That's the non-repeatable read the level allows.

# Preventing lost updates

> [!NOTE] Atomic update
>
> `UPDATE accounts SET balance = balance - 100 WHERE id = 1` — read-modify-write happens inside one statement. Best when possible.

> [!NOTE] Pessimistic lock
>
> `SELECT … FOR UPDATE` locks the row until commit, so the second transaction waits.

> [!NOTE] Optimistic check
>
> `UPDATE … SET balance = :new, version = version + 1 WHERE id = 1 AND version = :read_version` — 0 rows updated means someone else won; retry.

> [!NOTE] Serializable
>
> Let the database detect the conflict and abort one transaction; the app retries.

```question
What isolation level would you use?

---

Usually the engine default (Read Committed in PostgreSQL/SQL Server/Oracle, Repeatable Read in MySQL) combined with atomic updates or `SELECT … FOR UPDATE` for read-modify-write. Use `SERIALIZABLE` for complex invariants spanning several rows (write skew) and be ready to retry on serialization failures.
```

```question
What is a phantom read?

---

Re-running the same range query in one transaction returns a different <em>set</em> of rows because another transaction committed an insert or delete in that range. Non-repeatable reads are about changed values of existing rows; phantoms are about rows appearing or disappearing.
```
