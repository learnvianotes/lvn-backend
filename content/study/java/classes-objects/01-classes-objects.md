---
id: e189d285-db38-7ccd-8498-0caa3af51e25
key: topic:java/classes-objects
subject: java
topic: classes-objects
title: Classes & Objects
slug: classes-objects
order: 1
---

A <em>class</em> is a blueprint that bundles state (fields) and behaviour (methods); an <em>object</em> is one instance of it living on the heap.

> [!INFO]
>
> <strong>Class</strong> — a user-defined type that declares <strong>fields</strong> (what each object knows) and <strong>methods</strong> (what each object can do).

> [!INFO]
>
> <strong>Object</strong> — a concrete instance created with `new`. It has its own copy of every instance field and lives on the heap until no reference points to it.

# The four pillars of OOP

> [!NOTE] Encapsulation
>
> Hide state behind methods; the class controls how its data changes.

> [!NOTE] Abstraction
>
> Expose <em>what</em> an object does, not <em>how</em> — abstract classes and interfaces.

> [!NOTE] Inheritance
>
> A subclass reuses and extends a superclass (`extends`).

> [!NOTE] Polymorphism
>
> One reference type, many runtime behaviours — overriding + dynamic dispatch.

# Declaring a class and creating objects

```java filename:Java
public class Main {
    public static void main(String[] args) {
        BankAccount a = new BankAccount("Asha", 500);
        BankAccount b = new BankAccount("Ravi", 100);
        a.deposit(250);
        b.withdraw(30);
        System.out.println(a.describe());
        System.out.println(b.describe());
        System.out.println("accounts opened: " + BankAccount.count);
    }
}

class BankAccount {
    String owner;          // instance field: one copy per object
    double balance;
    static int count = 0;  // static field: one copy per class

    BankAccount(String owner, double balance) {   // constructor
        this.owner = owner;
        this.balance = balance;
        count++;
    }

    void deposit(double amount) { balance += amount; }
    void withdraw(double amount) { balance -= amount; }
    String describe() { return owner + " has " + balance; }
}
```

```text filename:Output
Asha has 750.0
Ravi has 70.0
accounts opened: 2
```

# What `new` does

1. <strong>Load the class</strong>

   If `BankAccount` isn't loaded yet, the class loader loads, links and initialises it (static fields/blocks run once).

2. <strong>Allocate</strong>

   Memory for the object is reserved on the heap; every field gets its default value (`0`, `false`, `null`).

3. <strong>Initialise</strong>

   Field initialisers and instance initializer blocks run, then the constructor body.

4. <strong>Return a reference</strong>

   `new` evaluates to a reference (think: a safe pointer) that is stored in the variable.

# References, not objects, live in variables

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Point p1 = new Point();
        p1.x = 1;
        Point p2 = p1;          // copies the reference, not the object
        p2.x = 99;
        System.out.println(p1.x);        // same object
        System.out.println(p1 == p2);    // same reference?

        Point p3 = new Point();
        p3.x = 99;
        System.out.println(p1 == p3);    // different objects

        Point nothing = null;
        System.out.println(nothing == null);
    }
}

class Point { int x, y; }
```

```text filename:Output
99
true
false
true
```

# Default values of fields

| Field type | Default |
| --- | --- |
| `byte`, `short`, `int`, `long` | `0` |
| `float`, `double` | `0.0` |
| `char` | `'\u0000'` |
| `boolean` | `false` |
| Any reference (`String`, arrays, objects) | `null` |

> [!WARNING] Watch out
>
> Only <strong>fields</strong> get defaults. Local variables have none — using one before assigning it is a compile error (`variable x might not have been initialized`).

# Instance vs class members

|  | Instance member | Static (class) member |
| --- | --- | --- |
| Belongs to | each object | the class itself |
| Copies | one per object | exactly one |
| Accessed via | `obj.field` | `ClassName.field` |
| Can use `this`? | Yes | No |

```question
What is the difference between a class and an object?

---

A class is a compile-time blueprint (a type); an object is a runtime instance of that type on the heap. One class, many objects — each with its own instance fields.
```

```question
Is p2 = p1 a copy of the object?

---

No. It copies the <em>reference</em>. Both variables point to the same object, so a change through one is visible through the other. To copy, write a copy constructor or factory (`new Point(p1)`).
```

```question
Where do objects and references live?

---

Objects live on the heap. A local reference variable lives in the method's stack frame; a reference stored in a field lives inside its owning object on the heap.
```
