---
id: c15dc67c-d10f-7bab-b48f-3322002ef308
key: topic:oops/ctor
subject: oops
topic: ctor
title: Constructors
slug: constructors
order: 1
---

A special method invoked automatically when an object is created. Used for initialization. Never has a return type.

> [!INFO]
>
> <strong>Constructor</strong> — a special member function with the same name as the class. Automatically called at object creation. No return type (not even void). Used to initialize data members. Memory is allocated when the constructor runs.

# Types of constructors

> [!NOTE] Default (non-parameterized) constructor
>
> No parameters. Gives default values. Called automatically when you write `Teacher t1;`
>
> `Teacher() {`<br>`  name = "Unknown"; salary = 0;`<br>`}`

> [!NOTE] Parameterized constructor
>
> Accepts arguments to initialize with specific values. You pass values at object creation.
>
> `Teacher(string n, int s) {`<br>`  name = n; salary = s;`<br>`}`<br>`// Usage:`<br>`Teacher t1("Rahul", 25000);`

> [!NOTE] Copy constructor
>
> Creates a new object as a copy of an existing one. Passed by reference to avoid infinite recursion.
>
> `Teacher(Teacher &orig) {`<br>`  name = orig.name;`<br>`  salary = orig.salary;`<br>`}`<br>`// Usage: Teacher t2(t1); — copies t1 into t2`

# Constructor overloading

> [!NOTE]
>
> <strong>Constructor overloading</strong> — multiple constructors in the same class, each with different parameters. C++ picks the right one based on what arguments you pass. This is compile-time polymorphism.

# Shallow vs Deep Copy

> [!DANGER] ⚠ Shallow copy
>
> - Copies all member values as-is
> - Pointers share the same memory
> - Default copy constructor does this
> - Dangerous with dynamic memory — double-free crash

> [!TIP] ✓ Deep copy
>
> - Copies values AND allocates new memory
> - Pointers point to separate independent copies
> - Must write custom copy constructor
> - Safe — no shared memory between objects

```cpp filename:C%2B%2B
// Deep copy — allocate new memory

Teacher(Teacher &orig) {

  name = orig.name;

  data = new int[size];  // new allocation!

  copy(orig.data, orig.data+size, data);

}
```
