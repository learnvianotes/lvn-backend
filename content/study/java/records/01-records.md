---
id: 2676d84e-bf27-7484-91fa-c55bb124ab40
key: topic:java/records
subject: java
topic: records
title: Records
slug: records
order: 1
---

A `record` (Java 16+) is a concise, immutable data carrier: declare the components and the compiler writes the constructor, accessors, `equals`, `hashCode` and `toString`.

> [!INFO]
>
> <strong>Record</strong> — a final class whose state is exactly its <strong>components</strong>: `record Point(int x, int y) {}` gets `private final` fields, a canonical constructor, accessors `x()` / `y()`, and value-based `equals`/`hashCode`/`toString`.

# What you get for free

```java filename:Java
import java.util.*;

public class Main {
    record Point(int x, int y) {}

    public static void main(String[] args) {
        Point p = new Point(3, 4);
        System.out.println(p);                     // generated toString
        System.out.println(p.x() + p.y());         // accessors: x(), not getX()
        System.out.println(p.equals(new Point(3, 4)));
        System.out.println(new HashSet<>(List.of(p)).contains(new Point(3, 4)));
    }
}
```

```text filename:Output
Point[x=3, y=4]
7
true
true
```

| Generated member | For `record Point(int x, int y)` |
| --- | --- |
| Fields | `private final int x; private final int y;` |
| Canonical constructor | `Point(int x, int y)` |
| Accessors | `int x()`, `int y()` |
| `equals` / `hashCode` | Compare / hash all components |
| `toString` | `Point[x=3, y=4]` |

# Compact constructor: validate and normalise

```java filename:Java
public class Main {
    record Range(int lo, int hi) {
        Range {                                    // compact canonical constructor: no parameter list
            if (lo > hi) throw new IllegalArgumentException("lo > hi: " + lo + " > " + hi);
        }
        int length() { return hi - lo; }           // extra methods are fine
        static Range of(int a, int b) {            // static factory
            return new Range(Math.min(a, b), Math.max(a, b));
        }
    }

    record Email(String value) {
        Email {
            value = value.trim().toLowerCase();     // reassign the parameter, not this.value
        }
    }

    public static void main(String[] args) {
        System.out.println(new Range(2, 9).length());
        System.out.println(Range.of(9, 2));
        System.out.println(new Email("  Asha@Mail.COM "));
        try {
            new Range(5, 1);
        } catch (IllegalArgumentException e) {
            System.out.println("rejected: " + e.getMessage());
        }
    }
}
```

```text filename:Output
7
Range[lo=2, hi=9]
Email[value=asha@mail.com]
rejected: lo > hi: 5 > 1
```

> [!NOTE] Key point
>
> In a compact constructor the fields are assigned <strong>after</strong> your code runs, from the (possibly reassigned) parameters. You cannot write `this.lo = …` there.

# Records and shallow immutability

```java filename:Java
import java.util.*;

public class Main {
    record Team(String name, List<String> members) {
        Team {
            members = List.copyOf(members);        // defensive, unmodifiable copy
        }
    }

    public static void main(String[] args) {
        List<String> list = new ArrayList<>(List.of("Asha"));
        Team t = new Team("core", list);
        list.add("Ravi");                          // doesn't leak into the record
        System.out.println(t.members());
        try {
            t.members().add("Mei");
        } catch (UnsupportedOperationException e) {
            System.out.println("members are read-only");
        }
    }
}
```

```text filename:Output
[Asha]
members are read-only
```

> [!WARNING] Watch out
>
> A record's fields are `final`, but the objects they point to are not magically immutable. A `List` component is still mutable unless you copy it with `List.copyOf` in the compact constructor.

# Rules and limitations

| Allowed | Not allowed |
| --- | --- |
| Static fields and methods, instance methods | Extra <strong>instance</strong> fields |
| Implementing interfaces | Extending a class (records implicitly extend `java.lang.Record`) |
| Nested records, generic records `record Pair<A, B>(A a, B b)` | Being extended — records are implicitly `final` |
| Overriding accessors / `toString` / `equals` | Mutating components (fields are `final`) |
| Annotations on components | Non-canonical constructors that don't delegate to `this(…)` |

> [!NOTE] Great for
>
> DTOs, API responses, map keys, tuples returned from methods, events, sealed-hierarchy cases with pattern matching.

> [!NOTE] Not for
>
> JPA entities (need mutability and a no-arg constructor), classes with hidden or derived mutable state.

```question
Record vs Lombok @Data vs a hand-written class?

---

A record is a language feature: immutable, transparent, no library needed, and it works with record patterns in `switch`. Lombok `@Data` generates <em>mutable</em> getters/setters. Write a normal class when you need mutability, inheritance or encapsulated state.
```

```question
Are records immutable?

---

Shallowly. The component fields are `private final` and there are no setters, but a mutable component (a `List`, an array) can still be changed through its reference unless you defensively copy it.
```

```question
Can a record have a no-arg constructor?

---

Only as a non-canonical constructor that delegates: `Point() { this(0, 0); }`. Every constructor must end up calling the canonical one.
```
