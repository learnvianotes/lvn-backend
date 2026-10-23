---
id: e56fbe41-d6d8-7ac4-85ff-ed03c7f0aa7b
key: topic:dbms/interview
subject: dbms
topic: interview
title: Interview Prep
slug: interview-prep
order: 1
---

Curated DBMS interview prep, core conceptual focus points, and common database interview cheats.

# Top 10 Frequently Asked Interview Questions

> [!NOTE] Q1: Explain the difference between Clustered and Non-Clustered index.
>
> A clustered index dictates the physical order in which rows are stored on disk. Because the data rows can only be sorted in one order, there can be at most one clustered index per table. A non-clustered index has a separate structure that contains search keys and pointers to the actual data rows. You can create multiple non-clustered indexes on a table.

> [!NOTE] Q2: Why are B+ Trees preferred over Binary Search Trees (BST) for disk storage?
>
> BSTs are deep and narrow, causing a high number of node travels. Since database pages live on disk, reading a node requires a disk block I/O. B+ Trees have a high fan-out (many children per node), making the tree short and wide. A search requires only 3-4 block reads even for millions of records, reducing I/O bottleneck.

> [!NOTE] Q3: What is the difference between 3NF and BCNF?
>
> BCNF is a stricter form of 3NF. In 3NF, for any functional dependency `X → Y`, either X is a superkey, or Y is a prime attribute. In BCNF, X must be a superkey. BCNF eliminates partial dependencies where a prime attribute is determined by a non-prime attribute.

> [!NOTE] Q4: Explain the difference between a Conflict and View Serializable schedule.
>
> A schedule is conflict serializable if it can be reduced to a serial schedule by swapping non-conflicting adjacent operations. A schedule is view serializable if it is view equivalent to some serial schedule. Every conflict serializable schedule is view serializable, but not vice versa (e.g., schedules with blind writes).

> [!NOTE] Q5: What are data anomalies and how does normalization solve them?
>
> Anomalies are side-effects of data redundancy in unnormalized tables: Insertion Anomaly (cannot add data without unrelated parent keys), Deletion Anomaly (losing data as a side-effect of deletion), and Update Anomaly (inconsistencies when duplicate records are not updated simultaneously). Normalization splits tables so that each fact is stored in exactly one place.

> [!NOTE] Q6: Explain the difference between optimistic and pessimistic concurrency control.
>
> Pessimistic concurrency control locks resources before modifications occur, assuming conflicts are highly likely. Optimistic concurrency control allows transactions to execute without locking, but checks for conflicts during the commit phase (using validation steps); it rolls back the transaction if a conflict occurred, assuming conflicts are rare.

> [!NOTE] Q7: What is write-ahead logging (WAL)?
>
> WAL is a database recovery protocol stating that all database modifications must be written to a persistent log file (on disk) <em>before</em> the actual changes are applied to the physical database pages. This guarantees durability and recoverability in case of power failure.

> [!NOTE] Q8: Explain the difference between 2-Tier and 3-Tier architecture.
>
> In a 2-Tier architecture, the client application runs queries directly on the database engine. In a 3-Tier architecture, the client communicates with an application server (API/backend), which performs validation/business logic and then queries the database engine, offering better scalability and security.

> [!NOTE] Q9: Why does Natural Join remove duplicate columns while Cartesian Product keeps them?
>
> Natural Join matches columns by name and merges them into one logical attribute to simplify relationships. Cartesian Product does not analyze column names; it simply pairs every attribute from Table A with every attribute from Table B, resulting in duplicate columns containing prefix names.

> [!NOTE] Q10: What are weak entity sets, and how do they map to schemas?
>
> Weak entity sets are entities that cannot be uniquely identified using only their own attributes and depend on a strong parent entity. They map to a separate table where the columns are the weak entity's attributes, plus the parent's Primary Key. The primary key of the weak table is a composite key: `{Parent_PK, Discriminator}`.

# Interview Tricks &amp; Common Confusions

> [!NOTE] Thomas Write Rule Edge Case
>
> An optimization on the Timestamp Concurrency protocol. If transaction T wants to write a data item, and the write timestamp is older than the current write timestamp of the item, instead of rolling back T, it simply <strong>discards the write</strong> because it was overwritten anyway. Only works if isolation levels allow.

> [!NOTE] Null vs Empty Values
>
> In databases, `NULL` represents the absence of data, whereas an empty string or 0 represents actual entered data. Standard SQL logical operations treat nulls using three-valued logic (True, False, Unknown).
