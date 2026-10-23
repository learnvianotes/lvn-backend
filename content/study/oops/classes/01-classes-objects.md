---
id: d98e4ac1-686c-70a0-94f2-d9313d1a9a30
key: topic:oops/classes
subject: oops
topic: classes
title: Classes & Objects
slug: classes-objects
order: 1
---

A class is a blueprint. An object is a real instance of that blueprint with its own state.

> [!INFO]
>
> <strong>Class</strong> — a user-defined data type that groups together data members (attributes) and member functions (methods) that operate on that data. Think of it as a cookie cutter.<br><br><strong>Object</strong> — a specific instance of a class. If `Teacher` is the class, then `t1` is an object with name="Rahul", subject="C++", salary=25000.

# C++ example

```cpp filename:C%2B%2B
class Teacher {

  public:

    string name;

    string subject;

    int salary;


    void display() {

      cout << name << " teaches " << subject;

    }

};


// Creating objects

Teacher t1;          // t1 is an object

t1.name = "Rahul";   // dot operator

t1.subject = "C++";

t1.display();
```

> [!NOTE] Dot Operator (.)
>
> Used to access members of an object. `t1.name` reads the `name` member from object `t1`. The bridge between object and its data.

> [!NOTE] Memory Allocation
>
> Memory is allocated when the object is created (when the constructor is called). Each object gets its own copy of data members. Static members are shared.
