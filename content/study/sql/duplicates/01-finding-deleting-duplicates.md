---
id: 9a6aef43-42ad-74e8-af67-e5439ae05f54
key: topic:sql/duplicates
subject: sql
topic: duplicates
title: Finding & Deleting Duplicates
slug: finding-deleting-duplicates
order: 1
---

Find rows that repeat a value that should be unique, show all copies, and delete all but one — three variations of the same `GROUP BY`/`ROW_NUMBER` idea.

```sql filename:SQL
SELECT * FROM contacts ORDER BY id;
```

```text filename:Output
id | name  | email
---+-------+---------------
1  | Asha  | asha@mail.com
2  | Ravi  | ravi@mail.com
3  | Asha  | ASHA@mail.com
4  | Meera | meera@mail.com
5  | Ravi  | ravi@mail.com
6  | Ravi  | ravi@mail.com
```

# Which values are duplicated?

```sql filename:SQL
SELECT email, COUNT(*) AS copies
FROM contacts
GROUP BY email
HAVING COUNT(*) > 1;

-- case-insensitive duplicates
SELECT lower(email) AS email, COUNT(*) AS copies, group_concat(id) AS ids
FROM contacts
GROUP BY lower(email)
HAVING COUNT(*) > 1
ORDER BY email;
```

```text filename:Output
email         | copies
--------------+-------
ravi@mail.com | 3

email         | copies | ids
--------------+--------+------
asha@mail.com | 2      | 1,3
ravi@mail.com | 3      | 2,5,6
```

# Show every duplicate row

```sql filename:SQL
SELECT id, name, email,
       COUNT(*) OVER (PARTITION BY email) AS copies
FROM contacts
ORDER BY email, id;
```

```text filename:Output
id | name  | email          | copies
---+-------+----------------+-------
3  | Asha  | ASHA@mail.com  | 1
1  | Asha  | asha@mail.com  | 1
4  | Meera | meera@mail.com | 1
2  | Ravi  | ravi@mail.com  | 3
5  | Ravi  | ravi@mail.com  | 3
6  | Ravi  | ravi@mail.com  | 3
```

```sql filename:SQL
-- rows whose (name, email) combination appears more than once
SELECT c.*
FROM contacts c
JOIN (SELECT name, email FROM contacts GROUP BY name, email HAVING COUNT(*) > 1) d
  ON d.name = c.name AND d.email = c.email
ORDER BY c.id;
```

```text filename:Output
id | name | email
---+------+--------------
2  | Ravi | ravi@mail.com
5  | Ravi | ravi@mail.com
6  | Ravi | ravi@mail.com
```

# Delete duplicates, keep the lowest id

```sql filename:SQL
DELETE FROM contacts
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn
        FROM contacts
    ) WHERE rn > 1
);

SELECT * FROM contacts ORDER BY id;
```

```text filename:Output
id | name  | email
---+-------+---------------
1  | Asha  | asha@mail.com
2  | Ravi  | ravi@mail.com
3  | Asha  | ASHA@mail.com
4  | Meera | meera@mail.com
```

```sql filename:SQL
-- without window functions: keep MIN(id) of each group
DELETE FROM contacts
WHERE id NOT IN (SELECT MIN(id) FROM contacts GROUP BY email);

SELECT * FROM contacts ORDER BY id;
```

```text filename:Output
id | name  | email
---+-------+---------------
1  | Asha  | asha@mail.com
2  | Ravi  | ravi@mail.com
3  | Asha  | ASHA@mail.com
4  | Meera | meera@mail.com
```

Contact 3 (`ASHA@mail.com`) survived both deletes: the comparison is case-sensitive. Partition/group by `lower(email)` when duplicates should be detected case-insensitively.

```sql filename:MySQL%20%2F%20SQL%20Server
-- MySQL: self-join delete
DELETE c1 FROM contacts c1
JOIN contacts c2 ON c2.email = c1.email AND c2.id < c1.id;

-- SQL Server: delete through a CTE
WITH d AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn FROM contacts)
DELETE FROM d WHERE rn > 1;
```

> [!TIP] Do
>
> After cleaning, add the constraint that should have been there: `CREATE UNIQUE INDEX ux_contacts_email ON contacts (lower(email));`

```question
How do you delete duplicate rows but keep one?

---

Number the rows within each duplicate group with `ROW_NUMBER() OVER (PARTITION BY <dup columns> ORDER BY id)` and delete those with `rn > 1`; or delete where `id NOT IN (SELECT MIN(id) … GROUP BY <dup columns>)`. If the table has no unique id at all, copy distinct rows to a new table (or use the engine's physical row id: `rowid` in SQLite, `ctid` in PostgreSQL).
```
