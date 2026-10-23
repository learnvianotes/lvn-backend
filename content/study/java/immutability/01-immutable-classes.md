---
id: 78a01bf2-ba4d-764e-a033-933866ea61e0
key: topic:java/immutability
subject: java
topic: immutability
title: Immutable Classes
slug: immutable-classes
order: 1
---

An immutable object's state can't change after construction. It is automatically thread-safe, safe to share and cache, and safe as a `HashMap` key — `String`, `Integer` and `LocalDate` are all immutable.

# The recipe

1. <strong>Make the class </strong><strong>`final`</strong>

   (or make constructors private with static factories) so no subclass can add mutable state.

2. <strong>Make every field </strong><strong>`private final`</strong>

   assigned once, in the constructor.

3. <strong>No setters</strong>

   no method that changes a field. "Withers" return a <em>new</em> object: `withPrice(…)`.

4. <strong>Defensive copy mutable inputs</strong>

   copy lists/arrays/dates passed to the constructor, so the caller can't change them later.

5. <strong>Never expose mutable internals</strong>

   return copies or unmodifiable views from getters.

# A broken "immutable" class

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> tags = new ArrayList<>(List.of("java"));
        Article a = new Article("Intro", tags);
        tags.add("hacked");                 // caller still holds the same list
        a.tags().clear();                   // getter hands out the internal list
        a.tags().add("oops");
        System.out.println(a.tags());
    }
}

final class Article {
    private final String title;
    private final List<String> tags;        // final reference, mutable list
    Article(String title, List<String> tags) { this.title = title; this.tags = tags; }
    List<String> tags() { return tags; }
}
```

```text filename:Output
[oops]
```

> [!WARNING] Watch out
>
> `final` makes the <em>reference</em> unchangeable, not the object it points to. A `final List` can still be cleared.

# Fixed with defensive copies

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> tags = new ArrayList<>(List.of("java"));
        Article a = new Article("Intro", tags);
        tags.add("hacked");                           // no effect on a
        try {
            a.tags().add("oops");
        } catch (UnsupportedOperationException e) {
            System.out.println("read-only");
        }
        Article b = a.withTitle("Basics");            // "modify" = new object
        System.out.println(a.title() + " " + a.tags());
        System.out.println(b.title() + " " + b.tags());
    }
}

final class Article {
    private final String title;
    private final List<String> tags;
    Article(String title, List<String> tags) {
        this.title = Objects.requireNonNull(title);
        this.tags = List.copyOf(tags);                // copy in (and unmodifiable)
    }
    String title() { return title; }
    List<String> tags() { return tags; }              // safe: already unmodifiable
    Article withTitle(String t) { return new Article(t, tags); }
}
```

```text filename:Output
read-only
Intro [java]
Basics [java]
```

# Unmodifiable view vs immutable copy

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> src = new ArrayList<>(List.of(1, 2));
        List<Integer> view = Collections.unmodifiableList(src);   // a read-only window
        List<Integer> copy = List.copyOf(src);                    // an independent snapshot
        src.add(3);
        System.out.println(view);    // sees the change!
        System.out.println(copy);    // doesn't
        try {
            List.of(1, null);
        } catch (NullPointerException e) {
            System.out.println("List.of rejects nulls");
        }
    }
}
```

```text filename:Output
[1, 2, 3]
[1, 2]
List.of rejects nulls
```

| API | Can you modify it? | Reflects source changes? | Nulls |
| --- | --- | --- | --- |
| `Collections.unmodifiableList(src)` | No (`UnsupportedOperationException`) | <strong>Yes</strong> — it's a view | Allowed |
| `List.copyOf(src)` / `Set.copyOf` / `Map.copyOf` | No | No — snapshot | Rejected |
| `List.of(…)` / `Set.of` / `Map.of` | No | — | Rejected |
| `stream().toList()` (16+) | No | No | Allowed |
| `Collectors.toList()` | Yes (currently an `ArrayList`) | No | Allowed |

# Why bother?

> [!NOTE] Thread-safe for free
>
> No state changes → no races, no locks. Can be shared across threads freely.

> [!NOTE] Safe keys & set members
>
> Hash code never changes, so the object never gets lost in a `HashMap`.

> [!NOTE] Cacheable & shareable
>
> `Integer.valueOf` cache, the string pool and `BigInteger.ZERO` all rely on immutability.

> [!NOTE] Easier reasoning
>
> Validate once in the constructor; the invariant holds forever. No defensive copies needed by callers.

The cost is allocating a new object for every change. For heavy step-by-step construction, pair the immutable class with a mutable builder (like `String` + `StringBuilder`).

```question
How do you make a class immutable?

---

`final` class, `private final` fields, no setters, validate in the constructor, defensively copy mutable arguments in, and never hand out references to mutable internals (return copies or unmodifiable collections). Records do most of this for you, except the deep copying.
```

```question
Why is String immutable?

---

So it can be pooled and shared (string literals), cache its hash code (fast `HashMap` keys), be used safely for security-sensitive values (class names, file paths, URLs) and be shared across threads without synchronization.
```

```question
Collections.unmodifiableList vs List.copyOf?

---

`unmodifiableList` is a read-only <em>view</em>: you can't modify through it, but changes to the underlying list show through. `List.copyOf` makes an independent immutable snapshot (and rejects nulls).
```
