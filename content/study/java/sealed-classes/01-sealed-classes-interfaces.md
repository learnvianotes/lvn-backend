---
id: b00f7840-f7ed-76d0-a939-73b10c324c0f
key: topic:java/sealed-classes
subject: java
topic: sealed-classes
title: Sealed Classes & Interfaces
slug: sealed-classes-interfaces
order: 1
---

A `sealed` type (Java 17) lists exactly which classes may extend it. The compiler then knows the full set of subtypes — which makes `switch` over them exhaustive.

> [!INFO]
>
> <strong>Sealed</strong> — `sealed interface Shape permits Circle, Square` — only the named types may directly implement `Shape`. Each permitted subtype must itself be `final`, `sealed` or `non-sealed`.

# Why seal a hierarchy?

> [!NOTE] Closed set of cases
>
> Model "one of these and nothing else": a `Result` is `Ok` or `Err`; a JSON value is one of six kinds.

> [!NOTE] Exhaustive switch
>
> `switch` over a sealed type needs no `default` — and adding a new subtype makes every non-exhaustive switch a <strong>compile error</strong>.

> [!NOTE] Controlled extension
>
> Public enough to use, not open for arbitrary subclassing — stronger than package-private, weaker than `final`.

# Subtype modifiers

| Permitted subtype is… | Meaning |
| --- | --- |
| `final` | No further subclasses (records and enums are implicitly final) |
| `sealed … permits …` | Continues the restriction one level down |
| `non-sealed` | Re-opens that branch — anyone may extend it |

# Sealed interface + records + pattern switch

```java filename:Java
public class Main {
    sealed interface Shape permits Circle, Square, Rect {}
    record Circle(double r) implements Shape {}
    record Square(double side) implements Shape {}
    record Rect(double w, double h) implements Shape {}

    static double area(Shape s) {
        return switch (s) {                    // exhaustive: no default
            case Circle c -> Math.PI * c.r() * c.r();
            case Square sq -> sq.side() * sq.side();
            case Rect(double w, double h) -> w * h;     // record pattern (Java 21)
        };
    }

    public static void main(String[] args) {
        Shape[] shapes = { new Circle(1), new Square(2), new Rect(2, 3) };
        for (Shape s : shapes) System.out.printf("%s -> %.2f%n", s, area(s));
    }
}
```

```text filename:Output
Circle[r=1.0] -> 3.14
Square[side=2.0] -> 4.00
Rect[w=2.0, h=3.0] -> 6.00
```

> [!NOTE] Key point
>
> This is Java's version of <em>algebraic data types</em>: the sealed interface is the "sum", each record is a "product". Together with pattern matching it replaces many uses of the Visitor pattern.

# Sealed classes with final / non-sealed

```java filename:Java
public class Main {
    static abstract sealed class Vehicle permits Car, Truck {}
    static final class Car extends Vehicle {}
    static non-sealed class Truck extends Vehicle {}      // open again
    static class Pickup extends Truck {}                  // allowed: Truck is non-sealed

    static String describe(Vehicle v) {
        return switch (v) {
            case Car c -> "car";
            case Truck t -> "truck (" + t.getClass().getSimpleName() + ")";
        };
    }

    public static void main(String[] args) {
        System.out.println(describe(new Car()));
        System.out.println(describe(new Pickup()));
    }
}
```

```text filename:Output
car
truck (Pickup)
```

# Trying to extend a sealed type

```java filename:Java
public class Main {
    sealed interface Shape permits Circle {}
    record Circle(double r) implements Shape {}
    record Triangle(double b, double h) implements Shape {}   // not in permits

    public static void main(String[] args) {}
}
```

```text filename:Compiler%20error
Main.java:4: error: class is not allowed to extend sealed class: Shape (as it is not listed in its 'permits' clause)
    record Triangle(double b, double h) implements Shape {}   // not in permits
    ^
```

- Permitted subclasses must be in the same <strong>module</strong> (or the same <strong>package</strong> in the unnamed module).
- If all subtypes are in the same source file, the `permits` clause can be omitted — the compiler infers it.
- Every permitted subtype must directly extend/implement the sealed type.

```question
Sealed class vs final class vs enum?

---

`final` allows no subclasses; an `enum` has a fixed set of <em>instances</em> of one type; a `sealed` type has a fixed set of <em>subtypes</em>, each of which can carry different data (e.g. `Circle(r)` vs `Rect(w, h)`).
```

```question
What does sealing buy you in a switch?

---

Exhaustiveness checking: the compiler knows every possible subtype, so a pattern `switch` needs no `default`, and adding a new permitted subtype turns every switch that forgot it into a compile error instead of a runtime surprise.
```
