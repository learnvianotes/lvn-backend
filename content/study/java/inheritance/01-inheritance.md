---
id: a999a6e1-e568-73b2-b763-4c531e6b8787
key: topic:java/inheritance
subject: java
topic: inheritance
title: Inheritance
slug: inheritance
order: 1
---

A subclass `extends` a superclass to inherit its fields and methods, adding or overriding behaviour — an <em>IS-A</em> relationship.

> [!INFO]
>
> <strong>Inheritance</strong> — the mechanism by which one class (subclass / child) acquires the non-private members of another (superclass / parent). Every class ultimately extends `java.lang.Object`.

# Basic syntax

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Dog d = new Dog("Rex");
        d.eat();          // inherited from Animal
        d.bark();         // Dog's own
        System.out.println(d.name + " is an Animal? " + (d instanceof Animal));
        System.out.println(d.getClass().getSuperclass().getSimpleName());
        System.out.println(Animal.class.getSuperclass().getName());
    }
}

class Animal {
    protected String name;
    Animal(String name) { this.name = name; }
    void eat() { System.out.println(name + " eats"); }
}

class Dog extends Animal {
    Dog(String name) { super(name); }
    void bark() { System.out.println(name + " barks"); }
}
```

```text filename:Output
Rex eats
Rex barks
Rex is an Animal? true
Animal
java.lang.Object
```

# What is (and isn't) inherited

| Member | Inherited? |
| --- | --- |
| `public` / `protected` fields and methods | Yes |
| Package-private members | Only if the subclass is in the same package |
| `private` members | No (they exist inside the object, but the subclass can't access them) |
| Constructors | No — they are called via `super(...)` |
| Static members | Accessible through the subclass, but <em>hidden</em> rather than overridden |

# Types of inheritance

| Type | Shape | In Java? |
| --- | --- | --- |
| Single | `B extends A` | Yes |
| Multilevel | `C extends B`, `B extends A` | Yes |
| Hierarchical | `B extends A`, `C extends A` | Yes |
| Multiple (classes) | `C extends A, B` | <strong>No</strong> — ambiguity (diamond problem) |
| Multiple (interfaces) | `C implements X, Y` | Yes — interfaces carry no instance state |
| Hybrid | mix of the above | Only via interfaces |

# Constructor chaining up the hierarchy

```java filename:Java
public class Main {
    public static void main(String[] args) {
        new Puppy();
    }
}

class Animal { Animal() { System.out.println("Animal()"); } }
class Dog extends Animal { Dog() { System.out.println("Dog()"); } }
class Puppy extends Dog { Puppy() { System.out.println("Puppy()"); } }
```

```text filename:Output
Animal()
Dog()
Puppy()
```

> [!NOTE] Key point
>
> Each constructor implicitly starts with `super()`, so construction runs top-down: `Object` → `Animal` → `Dog` → `Puppy`. The parent part of the object is always ready before the child's constructor body runs.

# No multiple inheritance of classes

```java filename:Java
class A { }
class B { }
class C extends A, B { }
```

```text filename:javac
Main.java:3: error: '{' expected
class C extends A, B { }
                 ^
```

# IS-A vs HAS-A: prefer composition

> [!NOTE] IS-A (inheritance)
>
> `Car extends Vehicle`. Tight coupling: the child depends on the parent's implementation details and is fixed at compile time.

> [!NOTE] HAS-A (composition)
>
> `Car` <em>has an</em> `Engine` field. Loose coupling: swap the part, test it alone, reuse it anywhere.

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        CountingBag viaInheritance = new CountingBag();
        viaInheritance.addAll(List.of("a", "b", "c"));
        System.out.println("inheritance count = " + viaInheritance.added);

        CountingWrapper viaComposition = new CountingWrapper();
        viaComposition.addAll(List.of("a", "b", "c"));
        System.out.println("composition count = " + viaComposition.added);
    }
}

class Bag {                                   // a parent you don't control
    private final List<String> items = new ArrayList<>();
    void add(String s) { items.add(s); }
    void addAll(List<String> c) { for (String s : c) add(s); }   // self-use: calls add()
}

class CountingBag extends Bag {               // IS-A: counts every item twice
    int added;
    @Override void add(String s) { added++; super.add(s); }
    @Override void addAll(List<String> c) { added += c.size(); super.addAll(c); }
}

class CountingWrapper {                       // HAS-A: forwards to a private Bag
    private final Bag bag = new Bag();
    int added;
    void add(String s) { added++; bag.add(s); }
    void addAll(List<String> c) { added += c.size(); bag.addAll(c); }
}
```

```text filename:Output
inheritance count = 6
composition count = 3
```

> [!WARNING] Watch out
>
> Extending a class you don't control ties you to its self-use patterns (the <em>fragile base class</em> problem). <em>Effective Java</em>: “Favor composition over inheritance” — inherit only when there is a true IS-A relationship and the parent was designed for extension.

```question
Why doesn't Java support multiple inheritance of classes?

---

To avoid the diamond problem: if `C extends A, B` and both define `m()` or a field `x`, which one does `C` get? Java allows multiple <em>interface</em> inheritance instead, where conflicts must be resolved explicitly and there is no instance state to duplicate.
```

```question
Are private members inherited?

---

They are part of the subclass object's memory, but not <em>inherited</em> as members: the subclass can't name or access them. It reaches them only through inherited non-private methods.
```

```question
What is the superclass of every class?

---

`java.lang.Object`. A class with no `extends` clause implicitly extends `Object`, which provides `equals`, `hashCode`, `toString`, `getClass`, `wait`/`notify` and more.
```
