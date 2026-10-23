---
id: 31a6ec8f-36b4-7663-a454-ea454751ae6b
key: topic:sql/transactions-acid
subject: sql
topic: transactions-acid
title: Transactions & ACID
slug: transactions-acid
order: 1
---

A transaction groups several statements into one unit of work that either <strong>fully happens or not at all</strong>. It is what makes a money transfer safe.

# ACID

| Property | Guarantee | Mechanism |
| --- | --- | --- |
| <strong>Atomicity</strong> | All statements succeed, or none take effect | Undo/rollback log |
| <strong>Consistency</strong> | Each transaction moves the DB from one valid state to another (constraints hold) | Constraints, triggers, your logic |
| <strong>Isolation</strong> | Concurrent transactions don't see each other's partial work (to a chosen degree) | Locks and/or MVCC snapshots |
| <strong>Durability</strong> | Once committed, changes survive crashes and power loss | Write-ahead log (WAL) flushed to disk |

# BEGIN, COMMIT, ROLLBACK

```sql filename:SQL
BEGIN;
UPDATE accounts SET balance = balance - 200 WHERE id = 1;
UPDATE accounts SET balance = balance + 200 WHERE id = 2;
COMMIT;

SELECT * FROM accounts ORDER BY id;
```

```text filename:Output
id | owner | balance
---+-------+--------
1  | Asha  | 800
2  | Ravi  | 700
```

```sql filename:SQL
BEGIN;
UPDATE accounts SET balance = balance - 200 WHERE id = 1;
-- …the app detects a problem before crediting Ravi
ROLLBACK;

SELECT * FROM accounts ORDER BY id;
```

```text filename:Output
id | owner | balance
---+-------+--------
1  | Asha  | 1000
2  | Ravi  | 500
```

# When a statement fails

A transfer of 1500 breaks the `CHECK (balance >= 0)` constraint on the debit:

```sql filename:SQL
BEGIN;
UPDATE accounts SET balance = balance + 1500 WHERE id = 2;   -- credit first
UPDATE accounts SET balance = balance - 1500 WHERE id = 1;   -- fails
COMMIT;
```

```text filename:Error
CHECK constraint failed: balance >= 0
```

> [!WARNING] Watch out
>
> In most engines, only the <strong>failing statement</strong> is undone automatically — the earlier credit is still pending inside the open transaction. The application must catch the error and issue `ROLLBACK` (PostgreSQL goes further: the whole transaction is marked aborted and only `ROLLBACK` is accepted). Drivers and ORMs usually wrap this in a `with transaction:` block.

# Savepoints: partial rollback

```sql filename:SQL
BEGIN;
INSERT INTO accounts VALUES (3, 'Meera', 300);
SAVEPOINT before_bonus;
UPDATE accounts SET balance = balance + 10000 WHERE id = 3;   -- mistake
ROLLBACK TO before_bonus;                                     -- undo only the bonus
COMMIT;

SELECT * FROM accounts ORDER BY id;
```

```text filename:Output
id | owner | balance
---+-------+--------
1  | Asha  | 1000
2  | Ravi  | 500
3  | Meera | 300
```

# Autocommit

Outside an explicit `BEGIN`, most engines run in <strong>autocommit</strong> mode: every statement is its own transaction. Oracle is the exception — a transaction starts implicitly and you must `COMMIT`. Python's DB-API and many drivers open transactions for you and require `conn.commit()`.

> [!TIP] Do
>
> Keep transactions short: do the reads and computation first, then `BEGIN` → writes → `COMMIT`. Long transactions hold locks, block other users and bloat MVCC history.

```question
Explain ACID with a bank transfer.

---

<strong>Atomicity</strong>: debit and credit both apply or neither does. <strong>Consistency</strong>: balances never go negative and total money is preserved (constraints). <strong>Isolation</strong>: a concurrent report never sees money “in flight” (debited but not yet credited). <strong>Durability</strong>: once the user sees “transfer complete”, a crash can't undo it.
```

```question
What is the difference between COMMIT and ROLLBACK?

---

`COMMIT` makes all changes of the transaction permanent and visible to others. `ROLLBACK` discards them, restoring the state at `BEGIN` (or at a `SAVEPOINT` with `ROLLBACK TO`).
```
