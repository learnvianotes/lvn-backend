---
id: 7b22e941-f536-7ec3-adfb-5810a4509b0d
key: topic:sql/nth-highest-salary
subject: sql
topic: nth-highest-salary
title: Nth Highest Salary
slug: nth-highest-salary
order: 1
---

The most-asked SQL interview question. Know three solutions, and be precise about <strong>ties</strong> and <strong>what to return when there is no Nth value</strong>.

Salaries (distinct, highest first): 150000, 120000, 110000, <strong>95000</strong> (Meera and Karan), 85000, 80000, … — so the 4th highest <em>distinct</em> salary is 95000.

# 1. DENSE\_RANK (best general answer)

```sql filename:SQL
WITH ranked AS (
    SELECT name, salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
    FROM employees
)
SELECT name, salary FROM ranked WHERE rnk = 4 ORDER BY name;
```

```text filename:Output
name  | salary
------+-------
Karan | 95000
Meera | 95000
```

Returns <em>every</em> employee with that salary. `RANK` would skip numbers after ties, and `ROW_NUMBER` would arbitrarily return only one of Meera/Karan and shift everyone below.

# 2. LIMIT / OFFSET on distinct salaries

```sql filename:SQL
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 3;          -- N - 1

-- return NULL (not zero rows) when N is too large: wrap it in a scalar subquery
SELECT (SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 99) AS nth_salary;
```

```text filename:Output
salary
------
95000

nth_salary
----------
NULL
```

# 3. Correlated subquery (no window functions)

```sql filename:SQL
-- the salary that has exactly N-1 distinct salaries above it
SELECT DISTINCT e.salary
FROM employees e
WHERE 3 = (SELECT COUNT(DISTINCT i.salary) FROM employees i WHERE i.salary > e.salary);
```

```text filename:Output
salary
------
95000
```

```sql filename:SQL
-- 2nd highest, the classic MAX-below-MAX trick
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

```text filename:Output
second_highest
--------------
120000
```

# Nth highest per department

```sql filename:SQL
WITH ranked AS (
    SELECT d.name AS department, e.name, e.salary,
           DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rnk
    FROM employees e JOIN departments d ON d.dept_id = e.dept_id
)
SELECT department, name, salary FROM ranked WHERE rnk = 2 ORDER BY department;
```

```text filename:Output
department  | name   | salary
------------+--------+-------
Engineering | Ravi   | 120000
HR          | Vikram | 80000
Sales       | Neha   | 72000
```

```sql filename:SQL%20Server%20%2F%20Oracle
SELECT DISTINCT salary FROM employees ORDER BY salary DESC
OFFSET 3 ROWS FETCH NEXT 1 ROWS ONLY;                  -- SQL Server 2012+ / Oracle 12c+

SELECT TOP 1 salary FROM (
    SELECT DISTINCT TOP 4 salary FROM employees ORDER BY salary DESC
) t ORDER BY salary ASC;                               -- older SQL Server
```

```question
Which approach would you give in an interview?

---

`DENSE_RANK()` in a CTE: it handles ties correctly, generalises to “per department” with `PARTITION BY`, and reads clearly. Mention `LIMIT/OFFSET` on `DISTINCT` salaries as the short alternative, and wrap it in a scalar subquery if the spec says “return NULL if there is no Nth salary”.
```
