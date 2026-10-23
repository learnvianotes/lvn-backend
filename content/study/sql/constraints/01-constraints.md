---
id: 7fcbf696-b14a-76c6-8614-751dbc5308b0
key: topic:sql/constraints
subject: sql
topic: constraints
title: Constraints
slug: constraints
order: 1
---

Constraints are rules the database enforces on every insert and update. They keep bad data out no matter which application, script or person writes it.

| Constraint | Guarantees | Sample database |
| --- | --- | --- |
| `PRIMARY KEY` | Unique <strong>and</strong> not null; identifies each row | `employees.emp_id` |
| `FOREIGN KEY` | Value must exist in the referenced table (or be `NULL`) | `employees.dept_id → departments` |
| `UNIQUE` | No two rows share the value (`NULL`s allowed) | `employees.email` |
| `NOT NULL` | A value must be supplied | `employees.name` |
| `CHECK` | A boolean condition must not be false | `salary > 0` |
| `DEFAULT` | Value used when the column is omitted | `status DEFAULT 'pending'` |

# Each one rejecting bad data

```sql filename:SQL%20%E2%80%94%20NOT%20NULL
INSERT INTO employees (emp_id, name, dept_id, salary, hire_date)
VALUES (11, NULL, 1, 50000, '2024-06-01');
```

```text filename:Error
NOT NULL constraint failed: employees.name
```

```sql filename:SQL%20%E2%80%94%20UNIQUE
INSERT INTO employees (emp_id, name, email, dept_id, salary, hire_date)
VALUES (11, 'Tara', 'asha@corp.in', 1, 50000, '2024-06-01');
```

```text filename:Error
UNIQUE constraint failed: employees.email
```

```sql filename:SQL%20%E2%80%94%20CHECK
UPDATE employees SET salary = -100 WHERE emp_id = 3;
```

```text filename:Error
CHECK constraint failed: salary > 0
```

```sql filename:SQL%20%E2%80%94%20FOREIGN%20KEY%20(child%20side)
INSERT INTO employees (emp_id, name, dept_id, salary, hire_date)
VALUES (11, 'Tara', 99, 50000, '2024-06-01');     -- there is no department 99
```

```text filename:Error
FOREIGN KEY constraint failed
```

```sql filename:SQL%20%E2%80%94%20FOREIGN%20KEY%20(parent%20side)
DELETE FROM departments WHERE dept_id = 1;         -- Engineering still has employees
```

```text filename:Error
FOREIGN KEY constraint failed
```

```sql filename:SQL%20%E2%80%94%20PRIMARY%20KEY
INSERT INTO employees (emp_id, name, dept_id, salary, hire_date)
VALUES (1, 'Tara', 1, 50000, '2024-06-01');       -- emp_id 1 is Asha
```

```text filename:Error
UNIQUE constraint failed: employees.emp_id
```

> [!NOTE] Key point
>
> `UNIQUE` still allows several `NULL`s — Neha and Dev both have a `NULL` email. `NULL` means <em>unknown</em>, and two unknowns are not considered equal. (SQL Server is the exception: it allows only one `NULL` in a unique column unless you use a filtered index.)

# Named constraints, composite keys, defaults

```sql filename:SQL
CREATE TABLE enrollments (
    student_id  INTEGER NOT NULL,
    course_id   INTEGER NOT NULL,
    grade       CHAR(1),
    enrolled_on TEXT    NOT NULL DEFAULT CURRENT_DATE,
    status      TEXT    NOT NULL DEFAULT 'active',
    CONSTRAINT pk_enrollment PRIMARY KEY (student_id, course_id),
    CONSTRAINT chk_grade CHECK (grade IN ('A', 'B', 'C', 'D', 'F'))
);
INSERT INTO enrollments (student_id, course_id) VALUES (1, 10);
SELECT student_id, course_id, grade, status,
       enrolled_on = CURRENT_DATE AS enrolled_today
FROM enrollments;
```

```text filename:Output
student_id | course_id | grade | status | enrolled_today
-----------+-----------+-------+--------+---------------
1          | 10        | NULL  | active | 1
```

```sql filename:SQL
INSERT INTO enrollments (student_id, course_id, grade) VALUES (1, 11, 'Z');
```

```text filename:Error
CHECK constraint failed: chk_grade
```

A <strong>named</strong> constraint shows up in the error (`chk_grade`), which makes failures much easier to diagnose — and you need the name to drop it later (`ALTER TABLE … DROP CONSTRAINT chk_grade`). Notice too that the first row's `NULL` grade passed the `CHECK`: a check only rejects a condition that is <strong>false</strong>, and `NULL IN (…)` is <em>unknown</em>. Add `NOT NULL` if the value is mandatory.

# Referential actions: what happens to children?

| `ON DELETE …` | When the parent row is deleted |
| --- | --- |
| `RESTRICT` / `NO ACTION` (default) | Refuse the delete while children exist |
| `CASCADE` | Delete the children too |
| `SET NULL` | Set the child's foreign key to `NULL` |
| `SET DEFAULT` | Set it to the column default |

```sql filename:SQL
PRAGMA foreign_keys = ON;
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE posts (
    id        INTEGER PRIMARY KEY,
    author_id INTEGER REFERENCES authors(id) ON DELETE CASCADE,
    title     TEXT
);
CREATE TABLE comments (
    id        INTEGER PRIMARY KEY,
    author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
    body      TEXT
);
INSERT INTO authors  VALUES (1, 'Asha'), (2, 'Ravi');
INSERT INTO posts    VALUES (1, 1, 'Intro to SQL'), (2, 2, 'Joins'), (3, 1, 'Indexes');
INSERT INTO comments VALUES (1, 1, 'Nice!'), (2, 2, 'Thanks');

DELETE FROM authors WHERE id = 1;

SELECT * FROM posts ORDER BY id;
SELECT * FROM comments ORDER BY id;
```

```text filename:Output
id | author_id | title
---+-----------+------
2  | 2         | Joins

id | author_id | body
---+-----------+-------
1  | NULL      | Nice!
2  | 2         | Thanks
```

> [!WARNING] Watch out
>
> Use `CASCADE` deliberately: deleting one customer could silently remove years of orders. Many teams prefer `RESTRICT` plus soft deletes (`is_active = 0`).

```question
What is the difference between PRIMARY KEY and UNIQUE?

---

Both enforce uniqueness and create an index. A table has <strong>one</strong> primary key and it can never be `NULL`; it is the row's identity and the target of foreign keys. A table can have <strong>many</strong> `UNIQUE` constraints and they allow `NULL`s (multiple, in most engines).
```

```question
Can a foreign key column be NULL?

---

Yes, unless it is also `NOT NULL`. A `NULL` foreign key means “no related row” (e.g. Dev has no department). The constraint is only checked for non-null values.
```

```question
Why enforce constraints in the database if the application validates input?

---

Several applications, scripts, admins and migrations write to the same database; bugs and race conditions happen (two requests inserting the same email at once). Only the database sees every write and can guarantee integrity atomically.
```
