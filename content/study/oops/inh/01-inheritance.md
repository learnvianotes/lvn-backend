---
id: c045efbd-ee61-7247-a5de-b489f20a5ba4
key: topic:oops/inh
subject: oops
topic: inh
title: Inheritance
slug: inheritance
order: 1
---

A derived class acquires properties and behavior from a base class. Enables code reuse — write once, inherit everywhere.

> [!INFO]
>
> <strong>Inheritance</strong> — when a child (derived) class inherits the data members and member functions of a parent (base) class. The child can use, extend, or override inherited behavior without rewriting it.

# Constructor / Destructor call order

Base constructor → Derived constructor| Destructor: reverse ↓

Derived destructor → Base destructor

# Types of inheritance

> [!NOTE] 1. Single inheritance
>
> One parent, one child. Simplest form.
>
> PersonStudent
>
> `class Student : public Person { };`

> [!NOTE] 2. Multi-level inheritance
>
> Chain of inheritance: grandparent → parent → child.
>
> PersonTeacherMathTeacher

> [!NOTE] 3. Multiple inheritance
>
> One child, multiple parents.
>
> StudentEmployeeIntern
>
> `class Intern : public Student, public Employee { };`

> [!NOTE] 4. Hierarchical inheritance
>
> One parent, multiple children.
>
> PersonStudentTeacher

> [!NOTE] 5. Hybrid inheritance
>
> Mix of multiple inheritance types. Example: Person → Student + Teacher → TA.
>
> Hybrid with multiple inheritance can create the <strong>Diamond Problem</strong> — ambiguity about which base class member to use. C++ solves this with `virtual` base classes.
