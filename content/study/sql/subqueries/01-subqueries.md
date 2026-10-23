---
id: b5c24785-12da-7dfa-8b60-3cde01be06c3
key: topic:sql/subqueries
subject: sql
topic: subqueries
title: Subqueries
slug: subqueries
order: 1
---

A subquery is a `SELECT` nested inside another statement. Its result is used as a single value, a list, or a whole table, depending on where it sits.

| Kind | Returns | Used in | Example |
| --- | --- | --- | --- |
| Scalar | One row, one column | `SELECT`, `WHERE`, `SET` | `salary > (SELECT AVG(salary) FROM employees)` |
| Row / list | One column, many rows | `IN`, `ANY`, `ALL` | `dept_id IN (SELECT …)` |
| Table (derived table) | Many rows and columns | `FROM`, `JOIN` | `FROM (SELECT …) AS t` |
| Correlated | Re-evaluated per outer row | `WHERE`, `SELECT` | next topic |

# Scalar subquery

```sql filename:SQL
-- employees paid above the company average (93700)
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC, emp_id;
```

```text filename:Output
name  | salary
------+-------
Asha  | 150000
Ravi  | 120000
Priya | 110000
Meera | 95000
Karan | 95000
```

```sql filename:SQL
-- scalar subquery in the SELECT list
SELECT name, salary,
       salary - (SELECT AVG(salary) FROM employees) AS diff_from_avg
FROM employees
WHERE dept_id = 2
ORDER BY emp_id;
```

```text filename:Output
name  | salary | diff_from_avg
------+--------+--------------
Priya | 110000 | 16300.0
Arjun | 70000  | -23700.0
Neha  | 72000  | -21700.0
```

> [!WARNING] Watch out
>
> A scalar subquery must return at most one row. PostgreSQL, SQL Server and Oracle raise an error if it returns more; SQLite and MySQL (in some contexts) silently take the first. Zero rows give `NULL`.

# List subquery: IN, ANY, ALL

```sql filename:SQL
-- employees working in a department located in Mumbai or Hyderabad
SELECT name FROM employees
WHERE dept_id IN (SELECT dept_id FROM departments WHERE location IN ('Mumbai', 'Hyderabad'))
ORDER BY emp_id;
```

```text filename:Output
name
------
Priya
Arjun
Neha
Vikram
Sara
```

```sql filename:PostgreSQL%20%2F%20MySQL%20%2F%20SQL%20Server%20%2F%20Oracle
-- earn more than EVERY Sales employee / more than ANY Sales employee
SELECT name FROM employees WHERE salary > ALL (SELECT salary FROM employees WHERE dept_id = 2);
SELECT name FROM employees WHERE salary > ANY (SELECT salary FROM employees WHERE dept_id = 2);
```

SQLite has no `ANY`/`ALL`; rewrite with aggregates — `> ALL (…)` is `> (SELECT MAX(…))` and `> ANY (…)` is `> (SELECT MIN(…))` (careful: they differ when the subquery is empty or contains `NULL`s).

```sql filename:SQL
SELECT name, salary FROM employees
WHERE salary > (SELECT MAX(salary) FROM employees WHERE dept_id = 2)
ORDER BY emp_id;
```

```text filename:Output
name | salary
-----+-------
Asha | 150000
Ravi | 120000
```

# Derived table (subquery in FROM)

```sql filename:SQL
-- average of per-department averages (not the same as the overall average!)
SELECT ROUND(AVG(dept_avg)) AS avg_of_dept_avgs
FROM (
    SELECT dept_id, AVG(salary) AS dept_avg
    FROM employees
    WHERE dept_id IS NOT NULL
    GROUP BY dept_id
) AS per_dept;
```

```text filename:Output
avg_of_dept_avgs
----------------
93833.0
```

```sql filename:SQL
-- join a table to an aggregated subquery: each employee vs their department average
SELECT e.name, e.dept_id, e.salary, ROUND(d.avg_sal) AS dept_avg
FROM employees e
JOIN (SELECT dept_id, AVG(salary) AS avg_sal FROM employees GROUP BY dept_id) d
  ON d.dept_id = e.dept_id
WHERE e.salary > d.avg_sal
ORDER BY e.emp_id;
```

```text filename:Output
name  | dept_id | salary | dept_avg
------+---------+--------+---------
Asha  | 1       | 150000 | 115000.0
Ravi  | 1       | 120000 | 115000.0
Priya | 2       | 110000 | 84000.0
Sara  | 3       | 85000  | 82500.0
```

> [!NOTE] Key point
>
> A derived table needs an alias in most engines (`AS per_dept`). When a subquery grows or is used twice, promote it to a <strong>CTE</strong> for readability.

```question
What is the difference between a subquery and a join?

---

A join combines columns from both tables into the result; a subquery computes a value/list/table used by the outer query. Many subqueries (`IN`, `EXISTS`) can be rewritten as joins and optimizers often do it automatically. Use a join when you need columns from both sides, a subquery for filtering or pre-aggregation.
```
