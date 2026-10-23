---
id: 40e34dec-e199-74db-87cd-1ddc76b8776d
key: topic:java/object-methods
subject: java
topic: object-methods
title: "The Object Class: equals, hashCode & toString"
slug: the-object-class-equals-hashcode-tostring
order: 1
---

Every class extends `java.lang.Object`. Its `equals`, `hashCode` and `toString` defaults are almost never what a value class wants — and `equals` and `hashCode` must be overridden <strong>together</strong>.

# What Object gives every class

| Method | Default behaviour | Override? |
| --- | --- | --- |
| `boolean equals(Object o)` | Identity: `this == o` | Yes, for value classes |
| `int hashCode()` | Identity-based number | <strong>Always together with </strong><strong>`equals`</strong> |
| `String toString()` | `ClassName@1b6d3586` (class + hex hash) | Yes — for logs and debugging |
| `Class<?> getClass()` | Runtime class | Final — cannot |
| `Object clone()` | Shallow field copy (needs `Cloneable`) | Rarely — prefer copy constructors |
| `wait / notify / notifyAll` | Monitor-based thread coordination | Final — cannot |
| `finalize()` | Deprecated for removal (Java 9+) | Never |

# The equals / hashCode contract

- <strong>Reflexive</strong>: `x.equals(x)` is `true`.
- <strong>Symmetric</strong>: `x.equals(y)` ⇔ `y.equals(x)`.
- <strong>Transitive</strong>: `x.equals(y)` and `y.equals(z)` ⇒ `x.equals(z)`.
- <strong>Consistent</strong>: repeated calls give the same answer while the objects don't change.
- `x.equals(null)` is `false`.
- <strong>Equal objects must have equal hash codes.</strong> (Unequal objects <em>may</em> share a hash code — that's a collision, which is legal.)

# A correct implementation

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Point a = new Point(1, 2), b = new Point(1, 2);
        System.out.println(a == b);          // different objects
        System.out.println(a.equals(b));     // same value
        System.out.println(a.hashCode() == b.hashCode());
        System.out.println(a);               // our toString

        Set<Point> set = new HashSet<>(List.of(a));
        System.out.println(set.contains(b));
    }
}

final class Point {
    private final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;                    // fast path
        if (!(o instanceof Point p)) return false;     // also handles null
        return x == p.x && y == p.y;
    }

    @Override
    public int hashCode() { return Objects.hash(x, y); }

    @Override
    public String toString() { return "Point[x=" + x + ", y=" + y + "]"; }
}
```

```text filename:Output
false
true
true
Point[x=1, y=2]
true
```

> [!NOTE] Key point
>
> `@Override` makes the compiler check that you really override. A classic bug is `public boolean equals(Point p)` — that <em>overloads</em> `equals(Object)`, so `HashSet` and `List.contains` never call it.

# What breaks when hashCode is missing

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Set<Key> set = new HashSet<>();
        set.add(new Key("id-7"));
        System.out.println(new Key("id-7").equals(new Key("id-7")));
        System.out.println(set.contains(new Key("id-7")));   // looks in the wrong bucket
    }
}

class Key {
    final String id;
    Key(String id) { this.id = id; }
    @Override public boolean equals(Object o) {
        return o instanceof Key k && id.equals(k.id);
    }
    // hashCode NOT overridden → identity hash, different for each object
}
```

```text filename:Output
true
false
```

`HashSet`/`HashMap` first use `hashCode()` to pick a bucket and only then call `equals` on the entries in that bucket. Two "equal" keys with different hash codes land in different buckets and are never compared.

> [!WARNING] Mutable keys
>
> Never use a <strong>mutable</strong> field in `hashCode` for an object stored in a hash collection. Change the field after inserting and the object is stranded in the old bucket: `contains` returns `false` and `remove` fails.

# `getClass()` vs `instanceof` in equals

| Check | Subclass instances | Trade-off |
| --- | --- | --- |
| `o instanceof Point p` | Can be equal to a `Point` | Liskov-friendly, but symmetry breaks if a subclass adds fields and overrides `equals` |
| `getClass() != o.getClass()` | Never equal to a `Point` | Strictly symmetric, but a harmless subclass (or proxy) is never equal |

Common guidance: make value classes `final` (or use a <strong>record</strong>) and use `instanceof` — then the question doesn't arise.

# Helpers in `java.util.Objects`

```java filename:Java
import java.util.Objects;

public class Main {
    public static void main(String[] args) {
        String a = null, b = "x";
        System.out.println(Objects.equals(a, b));          // null-safe, no NPE
        System.out.println(Objects.equals(null, null));
        System.out.println(Objects.hash(1, "a") == Objects.hash(1, "a"));
        System.out.println(Objects.hashCode(null));        // 0 for null
        System.out.println(Objects.toString(a, "n/a"));    // default for null
        System.out.println(Objects.requireNonNullElse(a, "fallback"));
        try {
            Objects.requireNonNull(a, "name must not be null");
        } catch (NullPointerException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
false
true
true
0
n/a
fallback
name must not be null
```

# clone() — briefly

`Object.clone()` makes a <strong>shallow</strong> copy and only works if the class implements the marker interface `Cloneable` (otherwise it throws `CloneNotSupportedException`). It bypasses constructors and is awkward with `final` fields. Arrays are the one place it's pleasant: `int[] copy = arr.clone();`.

> [!TIP] Do
>
> Prefer a copy constructor `new Point(other)` or a static factory `Point.copyOf(other)` over `clone()`.

```question
Why must you override hashCode when you override equals?

---

Hash-based collections look up the bucket by `hashCode()` before calling `equals`. If two equal objects return different hash codes, `HashMap.get`/`HashSet.contains` look in the wrong bucket and fail — the contract <em>equal ⇒ same hash</em> is broken.
```

```question
Can two unequal objects have the same hashCode?

---

Yes — that's a collision and it's allowed; the map then falls back to `equals` inside the bucket. Only the reverse is forbidden. Many collisions just make lookups slower.
```

```question
What does the default toString print?

---

`getClass().getName() + "@" + Integer.toHexString(hashCode())` — e.g. `Point@1b6d3586`. It is not a memory address, just the identity hash code in hex.
```

```question
What is wrong with public boolean equals(Point other)?

---

It overloads instead of overriding `equals(Object)`. Collections call `equals(Object)`, which is still the identity version. Always declare the parameter as `Object` and add `@Override`.
```
