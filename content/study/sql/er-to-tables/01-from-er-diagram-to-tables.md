---
id: 8a80ecba-bbb8-7c5d-8029-57c1121aabdb
key: topic:sql/er-to-tables
subject: sql
topic: er-to-tables
title: From ER Diagram to Tables
slug: from-er-diagram-to-tables
order: 1
---

An Entity–Relationship model describes <em>things</em> and <em>how they relate</em>; a few mechanical rules turn it into tables, keys and foreign keys.

# ER vocabulary

| ER concept | Becomes |
| --- | --- |
| Entity (Customer, Product) | A table |
| Attribute (name, price) | A column |
| Identifier | Primary key |
| Multivalued attribute (phone numbers) | A separate child table |
| Relationship | A foreign key, or a junction table |
| Weak entity (Order line depends on Order) | Table whose key includes the parent's key |

# Mapping relationships by cardinality

| Cardinality | Example | Implementation |
| --- | --- | --- |
| <strong>One-to-one</strong> (1:1) | Employee — Laptop allocation, User — Profile | FK with `UNIQUE` on one side (or share the same PK) |
| <strong>One-to-many</strong> (1:N) | Department — Employees, Customer — Orders | FK on the <strong>many</strong> side (`employees.dept_id`) |
| <strong>Many-to-many</strong> (M:N) | Orders — Products, Students — Courses | <strong>Junction table</strong> with two FKs (`order_items`) |
| Recursive | Employee — Manager | FK to the same table (`manager_id`) |

# The sample database as an ER model

- Department <strong>1 : N</strong> Employee → `employees.dept_id` (nullable: Dev has none).
- Employee <strong>1 : N</strong> Employee (manages) → `employees.manager_id`.
- Customer <strong>1 : N</strong> Order → `orders.customer_id` (`NOT NULL`: every order has a customer).
- Order <strong>M : N</strong> Product → junction table `order_items (order_id, product_id)` carrying relationship attributes `quantity` and `unit_price`.

# Worked example: a course platform

```sql filename:SQL
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name       TEXT NOT NULL
);
CREATE TABLE student_profiles (                        -- 1:1 with students
    student_id INTEGER PRIMARY KEY REFERENCES students(student_id),
    bio        TEXT
);
CREATE TABLE instructors (
    instructor_id INTEGER PRIMARY KEY,
    name          TEXT NOT NULL
);
CREATE TABLE courses (                                 -- 1:N instructor → courses
    course_id     INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    instructor_id INTEGER NOT NULL REFERENCES instructors(instructor_id)
);
CREATE TABLE enrollments (                             -- M:N students ↔ courses
    student_id  INTEGER REFERENCES students(student_id),
    course_id   INTEGER REFERENCES courses(course_id),
    enrolled_on TEXT NOT NULL,
    PRIMARY KEY (student_id, course_id)
);

INSERT INTO students    VALUES (1, 'Asha'), (2, 'Ravi');
INSERT INTO instructors VALUES (1, 'Dr. Rao');
INSERT INTO courses     VALUES (10, 'SQL', 1), (11, 'Python', 1);
INSERT INTO enrollments VALUES (1, 10, '2024-01-01'), (1, 11, '2024-01-02'), (2, 10, '2024-01-05');

SELECT s.name AS student, c.title AS course, i.name AS instructor
FROM enrollments e
JOIN students s    ON s.student_id = e.student_id
JOIN courses c     ON c.course_id = e.course_id
JOIN instructors i ON i.instructor_id = c.instructor_id
ORDER BY s.name, c.title;
```

```text filename:Output
student | course | instructor
--------+--------+-----------
Asha    | Python | Dr. Rao
Asha    | SQL    | Dr. Rao
Ravi    | SQL    | Dr. Rao
```

> [!WARNING] Watch out
>
> Never model many-to-many with a comma-separated list or with `course1`, `course2`, `course3` columns — you can't index, join, constrain or count them properly. Always use a junction table.

```question
How do you implement a many-to-many relationship?

---

With a junction (bridge/associative) table holding a foreign key to each side, whose primary key is usually the pair of FKs (`PRIMARY KEY (student_id, course_id)`). Attributes of the relationship itself (grade, quantity, enrolled date) live in the junction table.
```
