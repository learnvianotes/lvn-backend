---
id: 147bdf5b-1d92-754e-aabb-597b182cbca9
key: topic:java/final-keyword
subject: java
topic: final-keyword
title: The final Keyword
slug: the-final-keyword
order: 1
---

`final` means <em>cannot be changed after it is set</em>: a variable can't be reassigned, a method can't be overridden, a class can't be extended.

# `final` in three places

| Applied to | Effect | Example |
| --- | --- | --- |
| Variable (local, field, parameter) | Assigned exactly once | `final int max = 10;` |
| Method | Cannot be overridden by subclasses | `final void audit()` |
| Class | Cannot be extended | `String`, `Integer`, all records |

# Final variables

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static final double TAX_RATE = 0.18;         // constant: static final, UPPER_CASE

    public static void main(String[] args) {
        final List<String> names = new ArrayList<>();
        names.add("Asha");                        // OK: the object is mutable
        names.add("Ravi");
        // names = new ArrayList<>();             // error: cannot assign a value to final variable names
        System.out.println(names);

        final int limit;                          // "blank final": assigned once, later
        limit = args.length > 0 ? 5 : 10;
        System.out.println(limit + " " + TAX_RATE);
    }
}
```

```text filename:Output
[Asha, Ravi]
10 0.18
```

> [!WARNING] Watch out
>
> `final` freezes the <strong>reference</strong>, not the object. A `final List` can still be modified; for a truly unchangeable list use `List.of(...)` or `Collections.unmodifiableList(...)`.

# Blank finals must be assigned in every constructor

```java filename:Java
class Account {
    private final String id;
    Account(String id) { this.id = id; }
    Account() { }   // forgot to assign id
}
```

```text filename:javac
Main.java:4: error: variable id might not have been initialized
    Account() { }   // forgot to assign id
                ^
```

# Effectively final

A local variable that is never reassigned is <em>effectively final</em> even without the keyword. Lambdas and anonymous/local classes may only capture effectively final locals.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int base = 100;                       // never reassigned → effectively final
        Runnable r = () -> System.out.println(base + 1);
        r.run();
    }
}
```

```text filename:Output
101
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int count = 0;
        Runnable r = () -> System.out.println(count);
        count++;   // makes count NOT effectively final
        r.run();
    }
}
```

```text filename:javac
Main.java:4: error: local variables referenced from a lambda expression must be final or effectively final
        Runnable r = () -> System.out.println(count);
                                              ^
```

# Final methods and classes

- A `final` method keeps its behaviour fixed in every subclass — good for security-sensitive or template-method steps.
- A `final` class cannot be subclassed: `String`, the wrapper classes, `LocalDate`, every `record` and `enum` (without bodies).
- `private` methods are implicitly final (they aren't inherited, so nothing can override them).
- `abstract` and `final` together are illegal: one demands a subclass, the other forbids it.

# final vs finally vs finalize

| Keyword | What it is |
| --- | --- |
| `final` | Modifier: no reassignment / overriding / extending. |
| `finally` | Block after `try`/`catch` that always runs (cleanup). |
| `finalize()` | `Object` method once called by the GC before reclaiming an object — <strong>deprecated for removal</strong> since Java 18; use `try-with-resources` or `Cleaner`. |

```question
Does final make an object immutable?

---

No. It only stops the variable from being reassigned. Immutability needs a design: `final` class, `private final` fields, no setters, defensive copies of mutable parts.
```

```question
Why is String final?

---

So no subclass can break its immutability — which the string pool, `hashCode` caching, security checks (file paths, class names) and thread safety all rely on.
```

```question
Can a final variable be initialised later?

---

Yes — a <em>blank final</em>. A local must be assigned before use; an instance field in every constructor (or an initializer block); a static final in a static block. Exactly once.
```
