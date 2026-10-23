---
id: 65799c13-f3c0-72a5-9e49-ae479a0e7ec7
key: topic:sql/employee-manager-queries
subject: sql
topic: employee-manager-queries
title: Employee–Manager Queries
slug: employee-manager-queries
order: 1
---

The self-referencing `employees` table powers a whole family of interview questions. All of them are a self join, an aggregate, or a recursive CTE.

# Employees earning more than their manager

```sql filename:SQL
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

# Managers with at least N direct reports

```sql filename:SQL
SELECT m.name AS manager, COUNT(*) AS direct_reports
FROM employees e
JOIN employees m ON m.emp_id = e.manager_id
GROUP BY m.emp_id, m.name
HAVING COUNT(*) >= 2
ORDER BY direct_reports DESC, manager;
```

```text filename:Output
manager | direct_reports
--------+---------------
Asha    | 4
Priya   | 2
Ravi    | 2
```

# Employees who are not managers (leaf nodes)

```sql filename:SQL
SELECT e.name
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.emp_id)
ORDER BY e.emp_id;
```

```text filename:Output
name
-----
Meera
Karan
Arjun
Neha
Sara
Dev
```

# Employee, manager and department in one row

```sql filename:SQL
SELECT e.name AS employee,
       COALESCE(m.name, '—')      AS manager,
       COALESCE(d.name, 'Unassigned') AS department,
       CASE WHEN e.dept_id = m.dept_id THEN 'same' ELSE 'different' END AS manager_dept
FROM employees e
LEFT JOIN employees m   ON m.emp_id = e.manager_id
LEFT JOIN departments d ON d.dept_id = e.dept_id
ORDER BY e.emp_id;
```

```text filename:Output
employee | manager | department  | manager_dept
---------+---------+-------------+-------------
Asha     | —       | Engineering | different
Ravi     | Asha    | Engineering | same
Meera    | Ravi    | Engineering | same
Karan    | Ravi    | Engineering | same
Priya    | Asha    | Sales       | different
Arjun    | Priya   | Sales       | same
Neha     | Priya   | Sales       | same
Vikram   | Asha    | HR          | different
Sara     | Vikram  | HR          | same
Dev      | Asha    | Unassigned  | different
```

# Salary as a percentage of the manager's

```sql filename:SQL
SELECT e.name, e.salary, m.name AS manager,
       ROUND(100.0 * e.salary / m.salary, 1) AS pct_of_manager
FROM employees e JOIN employees m ON m.emp_id = e.manager_id
ORDER BY pct_of_manager DESC, e.emp_id
LIMIT 4;
```

```text filename:Output
name  | salary | manager | pct_of_manager
------+--------+---------+---------------
Sara  | 85000  | Vikram  | 106.3
Ravi  | 120000 | Asha    | 80.0
Meera | 95000  | Ravi    | 79.2
Karan | 95000  | Ravi    | 79.2
```

# Department salary above company average

```sql filename:SQL
SELECT d.name, ROUND(AVG(e.salary)) AS dept_avg
FROM employees e JOIN departments d ON d.dept_id = e.dept_id
GROUP BY d.dept_id, d.name
HAVING AVG(e.salary) > (SELECT AVG(salary) FROM employees)
ORDER BY dept_avg DESC;
```

```text filename:Output
name        | dept_avg
------------+---------
Engineering | 115000.0
```

```question
How do you find the full reporting chain of an employee?

---

A recursive CTE: anchor on the employee, then repeatedly join `employees m ON m.emp_id = chain.manager_id` until `manager_id` is `NULL` — see <em>Recursive CTEs</em>. For a fixed depth, chain self joins (`e → m1 → m2`).
```
