---
id: b42d0d52-e1a6-7293-9a41-8151638ac052
key: topic:java/polymorphism
subject: java
topic: polymorphism
title: Polymorphism & Dynamic Dispatch
slug: polymorphism-dynamic-dispatch
order: 1
---

One reference type, many behaviours: the JVM picks the overriding method of the <em>actual object</em> at runtime.

> [!INFO]
>
> <strong>Polymorphism</strong> — “many forms” — code written against a supertype works with any subtype. Java has <strong>compile-time</strong> polymorphism (overloading) and <strong>runtime</strong> polymorphism (overriding + dynamic dispatch).

# Runtime polymorphism

```java filename:Java
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Payment> payments = List.of(new Card(100), new Upi(250), new Cash(40));
        double total = 0;
        for (Payment p : payments) {             // one loop, three behaviours
            System.out.println(p.describe());
            total += p.fee();
        }
        System.out.println("total fees = " + total);
    }
}

abstract class Payment {
    protected final double amount;
    Payment(double amount) { this.amount = amount; }
    abstract double fee();
    String describe() { return getClass().getSimpleName() + " " + amount + " fee " + fee(); }
}

class Card extends Payment { Card(double a) { super(a); } double fee() { return amount * 0.02; } }
class Upi  extends Payment { Upi(double a)  { super(a); } double fee() { return 0; } }
class Cash extends Payment { Cash(double a) { super(a); } double fee() { return 1; } }
```

```text filename:Output
Card 100.0 fee 2.0
Upi 250.0 fee 0.0
Cash 40.0 fee 1.0
total fees = 3.0
```

> [!NOTE] Key point
>
> Adding a new payment type needs <strong>no change</strong> to the loop — that is the Open/Closed Principle in action, and why polymorphism beats `if (type == ...)` chains.

# Static type vs runtime type

| Question | Decided by | When |
| --- | --- | --- |
| Which methods may I <em>call</em>? | Reference (static) type | Compile time |
| Which overload is chosen? | Static types of the arguments | Compile time |
| Which override <em>runs</em>? | Runtime class of the object | Runtime (dynamic dispatch) |
| Which field is read? | Reference type — fields are not polymorphic | Compile time |
| Which static method runs? | Reference type | Compile time |

# How dynamic dispatch works

1. <strong>Compile</strong>

   `javac` checks the method exists on the static type and emits `invokevirtual Shape.area()` (or `invokeinterface`).

2. <strong>Look up</strong>

   At runtime the JVM reads the object's actual class and finds `area` in its <strong>method table</strong> (vtable) — the most specific override.

3. <strong>Optimise</strong>

   The JIT often <em>inlines</em> the call when only one implementation has been seen (monomorphic call site), so polymorphism is usually free.

# Upcasting and downcasting

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Animal a = new Dog();              // upcast: implicit, always safe
        a.speak();
        // a.fetch();                      // error: Animal has no fetch()

        if (a instanceof Dog d) {          // pattern matching (Java 16+): test + cast
            d.fetch();
        }
        Dog d2 = (Dog) a;                  // explicit downcast: checked at runtime
        d2.fetch();

        Animal c = new Cat();
        try {
            Dog wrong = (Dog) c;           // compiles, fails at runtime
            wrong.fetch();
        } catch (ClassCastException e) {
            System.out.println("ClassCastException");
        }
    }
}

class Animal { void speak() { System.out.println("..."); } }
class Dog extends Animal {
    @Override void speak() { System.out.println("Woof"); }
    void fetch() { System.out.println("fetching"); }
}
class Cat extends Animal { @Override void speak() { System.out.println("Meow"); } }
```

```text filename:Output
Woof
fetching
fetching
ClassCastException
```

> [!WARNING] Watch out
>
> A downcast is a promise to the compiler. If the object isn't really of that type you get `ClassCastException` at runtime — guard with `instanceof` (ideally the pattern form `if (x instanceof Dog d)`), or better, redesign so an overridden method does the work.

# Overloading is decided at compile time

```java filename:Java
public class Main {
    static String greet(Object o) { return "object"; }
    static String greet(String s) { return "string"; }

    public static void main(String[] args) {
        Object o = "hello";            // runtime type String, static type Object
        System.out.println(greet(o));  // overload chosen from the STATIC type
        System.out.println(greet("hello"));
        System.out.println(o.toString().length());   // override chosen at runtime
    }
}
```

```text filename:Output
object
string
5
```

```question
What is dynamic method dispatch?

---

The mechanism by which a call to an overridden method through a superclass reference is resolved at runtime, using the actual object's class. It is how runtime polymorphism is implemented (via method tables).
```

```question
Are fields polymorphic?

---

No. A field access is resolved from the reference's static type. If a subclass declares a field with the same name it <em>hides</em> the parent's; `parentRef.x` still reads the parent's field. Access state through methods instead.
```

```question
Can you achieve polymorphism without inheritance?

---

Yes, via interfaces: unrelated classes implementing the same interface can be used interchangeably. Overloading and generics are other (compile-time) forms.
```
