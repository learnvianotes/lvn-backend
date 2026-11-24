---
id: a973495b-1e83-7c6b-8382-6ebe85bef27b
key: topic:dbms/sql
subject: dbms
topic: sql
title: SQL Masterclass
slug: sql-masterclass
order: 1
---

Structured Query Language (SQL) is the standard declarative implementation language for database query operations. This section covers production-grade queries, syntax, and structures.

# DDL &amp; DML Syntax

> [!NOTE] Creating tables with constraints
>
> Common field constraints include `PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `UNIQUE`, `CHECK`, and `DEFAULT`.
>
> `CREATE TABLE Employees (`<br>`  EmpID INT PRIMARY KEY,`<br>`  Name VARCHAR(100) NOT NULL,`<br>`  Email VARCHAR(100) UNIQUE,`<br>`  Salary DECIMAL(10,2) CHECK (Salary > 0),`<br>`  DeptID INT,`<br>`  JoinDate DATE DEFAULT CURRENT_DATE,`<br>`  CONSTRAINT fk_dept FOREIGN KEY (DeptID) REFERENCES Departments(Id) ON DELETE SET NULL`<br>`);`

# SQL Joins Deep-Dive

Consider two tables: <strong>Employees</strong> (ID, Name, ManagerID) and <strong>Departments</strong> (ID, DeptName).

### Self Join Query

> [!NOTE] Self Join (Table references itself)
>
> Typically used for hierarchical columns in a single table, like employee-manager relations.
>
> `-- Find employees who earn more than their direct manager`<br>`SELECT e.Name AS Employee, m.Name AS Manager`<br>`FROM Employees e`<br>`INNER JOIN Employees m ON e.ManagerID = m.EmpID`<br>`WHERE e.Salary > m.Salary;`

### Cross Join Query

> [!NOTE] Cross Join (Cartesian Product)
>
> Returns the cartesian product of rows from both tables without matching conditions.
>
> `-- Generate all possible combinations of sizes and colors`<br>`SELECT s.SizeName, c.ColorName`<br>`FROM Sizes s`<br>`CROSS JOIN Colors c;`

# Aggregations &amp; Group By

> [!INFO]
>
> Aggregate functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) perform calculations on a set of values. <br>• <strong>GROUP BY:</strong> Groups rows sharing identical values in summary columns. <br>• <strong>HAVING:</strong> Filters grouped results. Equivalent to `WHERE` but runs <em>after</em> values are aggregated.

```sql filename:SQL
-- Get departments with more than 5 employees and an average salary above 60000
SELECT DeptID, COUNT(*) AS EmpCount, AVG(Salary) AS AvgSalary
FROM Employees
GROUP BY DeptID
HAVING COUNT(*) > 5 AND AVG(Salary) > 60000;
```

# Nested &amp; Subqueries

> [!NOTE] Correlated Subquery (EXISTS)
>
> The inner query executes repeatedly — once for each row evaluated by the outer query.
>
> `-- Find departments with active employees`<br>`SELECT d.DeptName`<br>`FROM Departments d`<br>`WHERE EXISTS (`<br>`   SELECT 1 FROM Employees e  `<br>`  WHERE e.DeptID = d.ID`<br>`);`

> [!NOTE] Common Table Expressions (CTEs)
>
> The `WITH` clause creates a temporary named result set, making complex queries readable.
>
> `-- Filter employees earning above average`<br>`WITH AvgSal AS (`<br>`  SELECT AVG(Salary) AS avg_s FROM Employees`<br>`)`<br>`SELECT Name, Salary `<br>`FROM Employees, AvgSal`<br>`WHERE Salary > avg_s;`

# Window Functions

Compute values across a set of table rows related to the current row, without collapsing the results (unlike GROUP BY):

| Function | Mechanics | Syntax / Usage |
| --- | --- | --- |
| <strong>ROW\_NUMBER()</strong> | Assigns a sequential integer to rows starting at 1. | SELECT Name, Salary, DeptID,<br> <strong>DENSE\_RANK() OVER (</strong><br> PARTITION BY DeptID<br> ORDER BY Salary DESC<br> <strong>)</strong> AS RankInDept<br> FROM Employees; |
| <strong>RANK()</strong> | Assigns rank values. Skips rank integers if duplicate values are found (e.g. 1, 2, 2, 4). |  |
| <strong>DENSE\_RANK()</strong> | Assigns rank values consecutively. Does not skip rank integers (e.g. 1, 2, 2, 3). |  |
| <strong>LEAD() / LAG()</strong> | Accesses data columns from rows directly ahead of (LEAD) or behind (LAG) the current row. | -- Compare employee salary to predecessor<br> LAG(Salary, 1) OVER (ORDER BY Salary) |

# Set Operations &amp; Views

> [!NOTE] UNION vs UNION ALL
>
> `UNION` combines query results and <strong>deduplicates</strong> rows (costly sort). `UNION ALL` merges row sets without removing duplicates, making it much faster.

> [!NOTE] Views & Indexes
>
> Views are virtual query shortcuts. Indexes speed up searches.
>
> `CREATE VIEW ActiveStaff AS`<br>`SELECT ID, Name, JoinDate FROM Employees WHERE Active=1;`<br><br>`CREATE INDEX idx_emp_salary ON Employees(Salary);`
