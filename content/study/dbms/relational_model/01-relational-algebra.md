---
id: c774b8f3-889c-7f17-bb1a-c800824f0b5b
key: topic:dbms/relational_model
subject: dbms
topic: relational_model
title: Relational Algebra
slug: relational-algebra
order: 1
---

Relational algebra is a mathematical procedural query language containing operations to retrieve data. Relational calculus is its non-procedural, declarative counterpart.

# Relational Algebra Operators

### Basic Operators

> [!NOTE] Selection (σ)
>
> Filters rows based on a logical predicate. Removes no columns.
>
> `σDept = 'HR' ∧ Salary > 50000(Employees)`

> [!NOTE] Projection (π)
>
> Selects specified columns and discards others. <strong>Removes duplicates</strong> automatically in relational theory.
>
> `πName, Dept(Employees)`

> [!NOTE] Union (∪)
>
> Combines rows from two tables. Both tables must be <strong>union-compatible</strong> (same number of columns, matching domain types in order).
>
> `Students ∪ Instructors`

> [!NOTE] Set Difference (-)
>
> Returns rows present in the first table but not in the second table. Must be union-compatible.
>
> `Students - Graduates`

> [!NOTE] Cartesian Product (×)
>
> Combines every row of the left table with every row of the right table. Output columns = Sum of columns; Output rows = Product of rows.
>
> `A × B`

### Derived Operators

> [!NOTE] Natural Join (⋈)
>
> Joins tables based on matching column names and data types, removing duplicate join columns from the output.
>
> `Employees ⋈ Departments`

> [!NOTE] Theta Join (⋈θ)
>
> An inner join that combines rows using an arbitrary comparison condition `θ` (e.g. `=, <, >, ≤, ≥, ≠`).
>
> `A ⋈A.Age < B.MinAge B`

> [!NOTE] Division (÷)
>
> Used for queries containing the word "all". R ÷ S returns tuples in R that are paired with <em>every</em> tuple in S.
>
> `Enrolls(Student, Course) ÷ Mandatory(Course)`

# Relational Calculus Syntax Comparison

| Aspect | Tuple Relational Calculus (TRC) | Domain Relational Calculus (DRC) |
| --- | --- | --- |
| <strong>Variables</strong> | Variables represent entire rows (tuples). e.g., `t` | Variables represent individual attributes (domains). e.g., `x, y, z` |
| <strong>Query focus</strong> | Filters rows. Very close to SQL concept. | Filters values in columns directly. More abstract. |
| <strong>Syntax</strong> | `{ t &#124; P(t) }` | `{ <x1, x2, ...> &#124; P(x1, x2, ...) }` |
| <strong>Example Query</strong><br>(Get Names of Students in CS dept) | `{ t.Name &#124; t ∈ Students ∧ t.Dept = 'CS' }` | `{ <n> &#124; ∃ i, d (<i, n, d> ∈ Students ∧ d = 'CS') }` |
