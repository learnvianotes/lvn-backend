---
id: fa87f55e-a770-7339-8de4-b3f5cf3ad000
key: topic:dbms/normalization
subject: dbms
topic: normalization
title: Normalization
slug: normalization
order: 1
---

Normalization is the mathematical process of decomposing tables to reduce data redundancy, eliminate data anomalies, and preserve functional dependencies.

# Database Anomalies Illustrated

Suppose we store student and course info in one unnormalized table:

```
Table: StudentCourse
StudentID | Name    | CourseID | CourseName | DeptHead
----------+---------+----------+------------+---------
101       | Alice   | CS10     | DBMS       | Dr. Smith
101       | Alice   | CS20     | Networks   | Dr. Smith
102       | Bob     | CS10     | DBMS       | Dr. Smith
```

> [!NOTE] Insertion Anomaly
>
> We cannot insert a new course (e.g. `CS30`, `OS` under `Dr. Jones`) unless we have at least one student enrolled in it, because StudentID is part of the primary key.

> [!NOTE] Deletion Anomaly
>
> If Bob (StudentID 102) drops `CS10` and we delete his row, we completely lose the details that `CS10` is called `DBMS` and managed by `Dr. Smith` if he was the only enrollee.

> [!NOTE] Update Anomaly
>
> If the department head for CS changes from `Dr. Smith` to `Dr. Alan`, we have to update multiple rows. If we miss even one row, the database state becomes inconsistent.

# Finding Candidate Keys Algorithm

> [!INFO]
>
> <strong>Algorithm:</strong> <br>1. Identify the set of all attributes in relation R. <br>2. Find attributes that <strong>never</strong> appear on the right-hand side (RHS) of any Functional Dependency (FD). These attributes <strong>must</strong> be part of every candidate key. <br>3. Compute the closure of this core attribute set. If the closure covers all attributes of R, it is the unique Candidate Key. <br>4. If not, add other attributes one by one and calculate closures until you find minimal sets that determine R.

# Armstrong's Axioms in Detail

| Axiom Rule | Mathematical Definition | Explanation / Example |
| --- | --- | --- |
| <strong>Reflexivity</strong> | If `Y ⊆ X`, then `X → Y` | If X contains Y, then X determines Y. e.g. `{ID, Name} → {Name}` |
| <strong>Augmentation</strong> | If `X → Y`, then `XZ → YZ` | Adding attributes to both sides preserves dependency. e.g. If `ID → Name`, then `{ID, Code} → {Name, Code}` |
| <strong>Transitivity</strong> | If `X → Y` and `Y → Z`, then `X → Z` | Chain rule. e.g. If `StudentID → ZipCode` and `ZipCode → City`, then `StudentID → City` |
| <strong>Union</strong> (Secondary) | If `X → Y` and `X → Z`, then `X → YZ` | If X determines two fields separately, it determines both. |
| <strong>Decomposition</strong> (Secondary) | If `X → YZ`, then `X → Y` and `X → Z` | We can split the RHS attributes into separate dependencies. |

# Normal Forms (1NF - 5NF)

### 1NF, 2NF, 3NF

| Normal Form | Core Requirement | Dependency Avoidance |
| --- | --- | --- |
| <strong>1NF</strong> (First Normal Form) | All column values must be atomic (no multi-valued attributes, no repeating groups). | Removes duplicate records and structural repeating nesting. |
| <strong>2NF</strong> (Second Normal Form) | Must satisfy 1NF, and have <strong>no Partial Dependency</strong>. | No non-prime attribute should depend on a proper subset of a candidate key. |
| <strong>3NF</strong> (Third Normal Form) | Must satisfy 2NF, and have <strong>no Transitive Dependency</strong>. | For every non-trivial FD `X → Y`, either X is a superkey or Y is a prime attribute. |

### BCNF, 4NF, 5NF

| Normal Form | Core Requirement | Details / Focus |
| --- | --- | --- |
| <strong>BCNF</strong> (Boyce-Codd Normal Form) | Stricter version of 3NF. For every non-trivial FD `X → Y`, <strong>X must be a superkey</strong>. | Eliminates cases where a prime attribute is determined by a non-prime attribute. |
| <strong>4NF</strong> (Fourth Normal Form) | Must satisfy BCNF and contain <strong>no Multi-Valued Dependencies</strong> (MVD). | Prevents independent 1-to-many relationships from creating duplicate records in one table. |
| <strong>5NF</strong> (Fifth Normal Form) | Must satisfy 4NF and have <strong>no Join Dependency</strong>. | Ensures a table cannot be decomposed and reconstructed without losing data. |

# Decomposition Properties

> [!NOTE] 1. Lossless Join Decomposition
>
> Ensures that when relation R is split into R1 and R2, joining them back (R1 ⋈ R2) reconstructs R exactly without inserting spurious tuples. <br><strong>Condition:</strong> `R1 ∩ R2 ≠ ∅` and either `(R1 ∩ R2) → R1` or `(R1 ∩ R2) → R2`.

> [!NOTE] 2. Dependency Preserving Decomposition
>
> Guarantees that all functional dependencies of the original relation can be validated inside the individual tables without performing joins. <br><strong>Condition:</strong> `(F1 ∪ F2)`<sup>`+`</sup>` = F`<sup>`+`</sup>.

# Denormalization

> [!INFO]
>
> <strong>Denormalization</strong> is an optimization technique where redundant data is intentionally added back to a normalized schema. <br>• <strong>Why?</strong> Excessively normalized databases require complex, slow multi-table joins. <br>• <strong>Tradeoff:</strong> Dramatically increases <strong>read speed</strong> but adds <strong>update overhead</strong> and storage requirements. Ideal for read-heavy analytical dashboards (OLAP), not transaction engines (OLTP).
