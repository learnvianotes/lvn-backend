---
id: 56f3952d-a5f8-7dc8-88f6-0f437bd00f7b
key: topic:java/best-practices
subject: java
topic: best-practices
title: Java Best Practices
slug: java-best-practices
order: 1
---

The habits that separate working Java from <em>good</em> Java — mostly from Joshua Bloch's <em>Effective Java</em>.

# Naming conventions

| Element | Convention | Example |
| --- | --- | --- |
| Class, interface, record, enum | `PascalCase`, nouns | `OrderService`, `Comparable` |
| Method | `camelCase`, verbs | `calculateTotal()`, `isEmpty()` |
| Variable / parameter | `camelCase` | `itemCount` |
| Constant (`static final`) | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Package | lowercase, reversed domain | `com.example.billing` |
| Type parameter | single capital letter | `T`, `E`, `K`, `V`, `R` |
| Enum constant | `UPPER_SNAKE_CASE` | `Status.IN_PROGRESS` |

# Effective Java highlights

> [!NOTE] Static factories
>
> Consider `of`/`valueOf`/`from` methods instead of constructors — named, cacheable, can return subtypes.

> [!NOTE] Builders
>
> Use a builder when a constructor would have many (optional) parameters.

> [!NOTE] Minimise mutability
>
> `final` fields, no setters, defensive copies (`List.copyOf`). Records make this the default.

> [!NOTE] Composition over inheritance
>
> Extend only classes designed for it; otherwise wrap and forward.

> [!NOTE] Program to interfaces
>
> Declare `List<String> names = new ArrayList<>()` — easy to switch implementation.

> [!NOTE] equals ⇒ hashCode
>
> Always override both, or hash-based collections break.

> [!NOTE] Empty, not null
>
> Return `List.of()` / `Optional.empty()` rather than `null`.

> [!NOTE] Enums, not int constants
>
> Type-safe, printable, switchable, can carry data and behaviour.

> [!NOTE] try-with-resources
>
> Never close resources by hand in `finally`.

> [!NOTE] Don't ignore exceptions
>
> An empty `catch` hides bugs. Handle, wrap with a cause, or rethrow.

# Composition over inheritance — the classic bug

Subclassing `HashSet` to count insertions double-counts, because `HashSet.addAll` internally calls the overridden `add`. You depended on an implementation detail of the superclass.

```java filename:Java
import java.util.Collection;
import java.util.HashSet;
import java.util.List;

public class Main {
    static class CountingSet<E> extends HashSet<E> {
        int added = 0;

        @Override public boolean add(E e) { added++; return super.add(e); }

        @Override public boolean addAll(Collection<? extends E> c) {
            added += c.size();
            return super.addAll(c);        // calls our add() again for every element!
        }
    }

    public static void main(String[] args) {
        CountingSet<String> s = new CountingSet<>();
        s.addAll(List.of("a", "b", "c"));
        System.out.println(s.added);       // expected 3
    }
}
```

```text filename:Output
6
```

> [!TIP] Do
>
> Wrap instead: a `ForwardingSet` that <em>holds</em> a `Set` and delegates to it — its behaviour can't be broken by changes in `HashSet`'s internals.

# equals without hashCode

```java filename:Java
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public class Main {
    static final class Bad {
        final int id;
        Bad(int id) { this.id = id; }
        @Override public boolean equals(Object o) { return o instanceof Bad b && b.id == id; }
        // hashCode NOT overridden → identity hash codes differ
    }

    static final class Good {
        final int id;
        Good(int id) { this.id = id; }
        @Override public boolean equals(Object o) { return o instanceof Good g && g.id == id; }
        @Override public int hashCode() { return Objects.hash(id); }
    }

    public static void main(String[] args) {
        Set<Bad> bad = new HashSet<>();
        bad.add(new Bad(1));
        System.out.println(bad.contains(new Bad(1)));

        Set<Good> good = new HashSet<>();
        good.add(new Good(1));
        System.out.println(good.contains(new Good(1)));
    }
}
```

```text filename:Output
false
true
```

# Return empty, not null

```java filename:Java
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class Main {
    static final Map<String, List<String>> ORDERS = Map.of("asha", List.of("book", "pen"));

    static List<String> ordersOf(String user) {
        return ORDERS.getOrDefault(user, List.of());     // never null
    }

    static Optional<String> firstOrder(String user) {
        return ordersOf(user).stream().findFirst();
    }

    public static void main(String[] args) {
        for (String item : ordersOf("ravi")) System.out.println(item);   // simply loops 0 times
        System.out.println(ordersOf("ravi").size());
        System.out.println(firstOrder("asha").orElse("none"));
        System.out.println(firstOrder("ravi").orElse("none"));
    }
}
```

```text filename:Output
0
book
none
```

# Code hygiene checklist

> [!TIP] Do
>
> Use `final` for fields that never change; keep variables in the narrowest scope; validate arguments early (`Objects.requireNonNull`); prefer `for-each` and streams where clearer; log with a logger (SLF4J), not `System.out`; write unit tests (JUnit 5).

> [!DANGER] Avoid
>
> Raw types (`List` instead of `List<String>`); `catch (Exception e) {}`; `==` on strings; public mutable fields; huge god classes; premature optimisation; returning `null` for "no results"; exposing internal mutable collections.

| Instead of… | Prefer… |
| --- | --- |
| `new Integer(5)` (deprecated) | `Integer.valueOf(5)` or autoboxing |
| `Vector`, `Hashtable`, `Stack` | `ArrayList`, `HashMap` / `ConcurrentHashMap`, `ArrayDeque` |
| `Date`, `Calendar`, `SimpleDateFormat` | `LocalDate`, `Instant`, `DateTimeFormatter` |
| `int` status codes | an `enum` |
| Manual `close()` in `finally` | `try-with-resources` |
| `if (x != null) x.foo()` chains | `Optional` for return values, or `Objects.requireNonNullElse` |

```question
Why prefer composition over inheritance?

---

Inheritance breaks encapsulation: the subclass depends on how the superclass implements its methods (the `addAll` → `add` double count), and superclass changes can silently break it. Composition depends only on the public interface, can be swapped at run time, and doesn't inherit an API you don't want.
```

```question
Why return an empty collection instead of null?

---

Callers can iterate, stream or call `size()` without a null check, so there are no `NullPointerException`s and no duplicated `if (list != null)` code. Immutable empties like `List.of()` cost nothing to create.
```
