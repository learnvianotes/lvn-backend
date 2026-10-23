---
id: 9c02de43-39f4-7aed-b913-4caaa2b7527a
key: topic:sql/cross-self-join
subject: sql
topic: cross-self-join
title: CROSS JOIN & SELF JOIN
slug: cross-join-self-join
order: 1
---

A cross join pairs every row with every row; a self join matches a table with itself. Both are ordinary joins used in less ordinary ways.

# CROSS JOIN: every combination

```sql filename:SQL
CREATE TABLE sizes  (size TEXT);
CREATE TABLE colors (color TEXT);
INSERT INTO sizes  VALUES ('S'), ('M'), ('L');
INSERT INTO colors VALUES ('Black'), ('White');

SELECT s.size, c.color
FROM sizes s CROSS JOIN colors c
ORDER BY c.color, s.size;
```

```text filename:Output
size | color
-----+------
L    | Black
M    | Black
S    | Black
L    | White
M    | White
S    | White
```

3 × 2 = 6 rows. Real uses: generating all product variants, a calendar × store grid to report zero-sales days, or combining a single-row settings table with every row.

```sql filename:SQL
-- every department × every month of Q1, so empty months still appear
WITH months(m) AS (VALUES ('2024-01'), ('2024-02'), ('2024-03'))
SELECT d.name, m.m AS month
FROM departments d CROSS JOIN months m
WHERE d.dept_id <= 2
ORDER BY d.name, month;
```

```text filename:Output
name        | month
------------+--------
Engineering | 2024-01
Engineering | 2024-02
Engineering | 2024-03
Sales       | 2024-01
Sales       | 2024-02
Sales       | 2024-03
```

> [!WARNING] Watch out
>
> Cross joins grow multiplicatively: 10 000 × 10 000 rows = 100 million. An accidental one (missing join condition) is a classic cause of runaway queries.

# SELF JOIN: employees and their managers

`employees.manager_id` points at another row of `employees`. Join the table to itself under two aliases — one playing <em>employee</em>, one playing <em>manager</em>.

```sql filename:SQL
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.emp_id = e.manager_id
ORDER BY e.emp_id;
```

```text filename:Output
employee | manager
---------+--------
Asha     | NULL
Ravi     | Asha
Meera    | Ravi
Karan    | Ravi
Priya    | Asha
Arjun    | Priya
Neha     | Priya
Vikram   | Asha
Sara     | Vikram
Dev      | Asha
```

`LEFT JOIN` keeps Asha, who has no manager. With an inner join she would vanish.

```sql filename:SQL
-- employees who earn more than their manager (a top interview question)
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON m.emp_id = e.manager_id
WHERE e.salary > m.salary;
```

```text filename:Output
employee | salary | manager | manager_salary
---------+--------+---------+---------------
Sara     | 85000  | Vikram  | 80000
```

# Self join to compare rows: pairs

```sql filename:SQL
-- pairs of employees in the same department (each pair once)
SELECT a.name AS first, b.name AS second, a.dept_id
FROM employees a
JOIN employees b ON b.dept_id = a.dept_id AND a.emp_id < b.emp_id
WHERE a.dept_id IN (2, 3)
ORDER BY a.dept_id, a.emp_id, b.emp_id;
```

```text filename:Output
first  | second | dept_id
-------+--------+--------
Priya  | Arjun  | 2
Priya  | Neha   | 2
Arjun  | Neha   | 2
Vikram | Sara   | 3
```

> [!NOTE] Key point
>
> `a.emp_id < b.emp_id` removes self-pairs (Priya–Priya) and mirrored duplicates (Priya–Arjun and Arjun–Priya). `<>` would keep both mirrors.

```question
What is a self join and when is it used?

---

A join of a table with itself using two aliases. Used for hierarchical data stored as a parent pointer (employee → manager, category → parent category), for comparing rows within the same table (pairs, duplicates, consecutive events), and for “earns more than manager”-style questions.
```
