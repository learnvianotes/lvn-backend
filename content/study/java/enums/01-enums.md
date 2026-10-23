---
id: e7b92afd-a7f5-751e-9cdc-bb140136ab5f
key: topic:java/enums
subject: java
topic: enums
title: Enums
slug: enums
order: 1
---

An `enum` is a class with a fixed, named set of instances. It's type-safe, can carry fields and behaviour, and works in `switch`, `EnumMap` and `EnumSet`.

> [!INFO]
>
> <strong>Enum</strong> — a special class whose instances are exactly the listed constants, created once when the class loads. Each constant is a `public static final` instance; every enum implicitly extends `java.lang.Enum`.

# Built-in methods

```java filename:Java
public class Main {
    enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

    public static void main(String[] args) {
        Day d = Day.WED;
        System.out.println(d + " " + d.name() + " " + d.ordinal());
        System.out.println(Day.valueOf("FRI").compareTo(Day.MON));  // by ordinal
        System.out.println(Day.values().length);
        System.out.println(d == Day.WED);          // safe: constants are singletons
        try {
            Day.valueOf("Funday");
        } catch (IllegalArgumentException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
WED WED 2
4
7
true
No enum constant Main.Day.Funday
```

| Member | Meaning |
| --- | --- |
| `values()` | Array of all constants in declaration order (a fresh copy each call) |
| `valueOf(String)` | Constant by exact name, else `IllegalArgumentException` |
| `name()` / `toString()` | Declared name (`toString` can be overridden, `name` cannot) |
| `ordinal()` | 0-based position — don't persist it; reordering constants changes it |
| `compareTo` | Compares by ordinal; enums are `Comparable` |

# Fields, constructors and methods

```java filename:Java
public class Main {
    enum Planet {
        MERCURY(3.303e+23, 2.4397e6),
        EARTH(5.976e+24, 6.37814e6);

        private final double mass, radius;            // per-constant data
        Planet(double mass, double radius) {          // constructor is implicitly private
            this.mass = mass;
            this.radius = radius;
        }
        double surfaceGravity() {
            return 6.67300E-11 * mass / (radius * radius);
        }
    }

    public static void main(String[] args) {
        for (Planet p : Planet.values())
            System.out.printf("%s %.2f%n", p, p.surfaceGravity());
    }
}
```

```text filename:Output
MERCURY 3.70
EARTH 9.80
```

# Constant-specific bodies

```java filename:Java
public class Main {
    enum Op {
        ADD("+") { int apply(int a, int b) { return a + b; } },
        MUL("*") { int apply(int a, int b) { return a * b; } };

        final String symbol;
        Op(String symbol) { this.symbol = symbol; }
        abstract int apply(int a, int b);            // each constant must implement it
    }

    public static void main(String[] args) {
        for (Op op : Op.values())
            System.out.println("6 " + op.symbol + " 7 = " + op.apply(6, 7));
    }
}
```

```text filename:Output
6 + 7 = 13
6 * 7 = 42
```

# Switch over an enum

```java filename:Java
public class Main {
    enum Level { LOW, MEDIUM, HIGH }

    static String action(Level l) {
        return switch (l) {             // exhaustive: no default needed
            case LOW -> "ignore";
            case MEDIUM -> "log";
            case HIGH -> "page on-call";
        };
    }

    public static void main(String[] args) {
        for (Level l : Level.values()) System.out.println(l + " -> " + action(l));
    }
}
```

```text filename:Output
LOW -> ignore
MEDIUM -> log
HIGH -> page on-call
```

> [!NOTE] Key point
>
> In a `case` label you write the bare constant `LOW`, not `Level.LOW` (qualified names in case labels are only allowed from Java 21). A switch <em>expression</em> over an enum must cover every constant or have a `default`.

# EnumSet and EnumMap

```java filename:Java
import java.util.*;

public class Main {
    enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

    public static void main(String[] args) {
        EnumSet<Day> weekend = EnumSet.of(Day.SAT, Day.SUN);          // a bit vector inside
        EnumSet<Day> weekdays = EnumSet.complementOf(weekend);
        System.out.println(weekdays);
        System.out.println(EnumSet.range(Day.TUE, Day.THU));

        Map<Day, Integer> hours = new EnumMap<>(Day.class);          // array indexed by ordinal
        hours.put(Day.FRI, 6);
        hours.put(Day.MON, 8);
        System.out.println(hours);                                   // always in declaration order
    }
}
```

```text filename:Output
[MON, TUE, WED, THU, FRI]
[TUE, WED, THU]
{MON=8, FRI=6}
```

> [!TIP] Do
>
> Use `EnumSet` instead of bit flags and `EnumMap` instead of `HashMap` with enum keys — both are faster, compact, and iterate in declaration order.

# The enum singleton

```java filename:Java
public class Main {
    enum Registry {
        INSTANCE;
        private int count;
        int next() { return ++count; }
    }

    public static void main(String[] args) {
        Registry.INSTANCE.next();
        System.out.println(Registry.INSTANCE.next());
    }
}
```

```text filename:Output
2
```

<em>Effective Java</em> calls a single-element enum the best singleton: the JVM guarantees one instance, it is thread-safe to initialise, and it is safe against reflection and serialization attacks that break classic singletons.

> [!WARNING] Watch out
>
> Don't store or persist `ordinal()` (e.g. in a database). Adding or reordering a constant silently changes every ordinal. Persist `name()` or an explicit code field instead.

```question
Can an enum extend a class? Implement an interface?

---

It cannot extend anything — it already extends `java.lang.Enum`. It <em>can</em> implement interfaces, which is a common way to make several enums interchangeable.
```

```question
Why is comparing enums with == safe?

---

Each constant is created exactly once per class loader and can't be instantiated again (constructors are private; reflection and deserialization are blocked). So identity equals equality, and `==` is also null-safe.
```

```question
Why can't an enum constructor be public?

---

The set of instances is fixed at compile time. Allowing `new` would break that guarantee, so enum constructors are implicitly `private`.
```
