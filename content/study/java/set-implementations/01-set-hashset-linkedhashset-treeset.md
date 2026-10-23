---
id: 5a0ab5cb-6fec-7949-905d-efe9844bc711
key: topic:java/set-implementations
subject: java
topic: set-implementations
title: "Set: HashSet, LinkedHashSet & TreeSet"
slug: set-hashset-linkedhashset-treeset
order: 1
---

A `Set` stores each element at most once. The three implementations differ only in <em>ordering</em> and <em>speed</em>: hash (no order), linked hash (insertion order), tree (sorted).

> [!INFO]
>
> <strong>Set</strong> — a collection with no duplicate elements — `add` returns `false` if an <em>equal</em> element is already present. “Equal” means `equals`/`hashCode` for hash sets and `compareTo`/`compare` == 0 for `TreeSet`.

# Comparison

|  | `HashSet` | `LinkedHashSet` | `TreeSet` |
| --- | --- | --- | --- |
| Backed by | a `HashMap` (elements are keys) | a `LinkedHashMap` | a `TreeMap` (red-black tree) |
| Iteration order | Unspecified | Insertion order | Sorted (natural or `Comparator`) |
| `add` / `remove` / `contains` | O(1) average | O(1) average | O(log n) |
| `null` element | One allowed | One allowed | No (`NullPointerException`) |
| Needs | `equals` + `hashCode` | `equals` + `hashCode` | `Comparable` or a `Comparator` |
| Extra API | — | `reversed()`, `getFirst()` (Java 21) | `first`, `floor`, `ceiling`, `headSet`, `subSet`… |

# Same input, three orders

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> input = List.of(42, 7, 19, 7, 3, 42);
        System.out.println("HashSet       " + new HashSet<>(input));
        System.out.println("LinkedHashSet " + new LinkedHashSet<>(input));
        System.out.println("TreeSet       " + new TreeSet<>(input));

        Set<String> seen = new HashSet<>();
        System.out.println(seen.add("x") + " " + seen.add("x"));   // second add is rejected
    }
}
```

```text filename:Output
HashSet       [19, 3, 7, 42]
LinkedHashSet [42, 7, 19, 3]
TreeSet       [3, 7, 19, 42]
true false
```

> [!NOTE] Key point
>
> `HashSet`'s order above comes from the bucket index (`hash & (capacity − 1)`: 42→10, 7→7, 19→3, 3→3 with 16 buckets). It is an implementation detail that changes as the set resizes — never depend on it.

# `TreeSet` as a `NavigableSet`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        TreeSet<Integer> ts = new TreeSet<>(List.of(10, 20, 30, 40, 50));
        System.out.println(ts.first() + " " + ts.last());
        System.out.println(ts.floor(25) + " " + ts.ceiling(25));   // <= 25, >= 25
        System.out.println(ts.lower(20) + " " + ts.higher(20));    // < 20, > 20
        System.out.println(ts.floor(5));                           // none -> null
        System.out.println(ts.headSet(30) + " " + ts.tailSet(30)); // [..30) and [30..]
        System.out.println(ts.subSet(20, true, 40, true));
        System.out.println(ts.descendingSet());
        System.out.println(ts.pollFirst() + " -> " + ts);
    }
}
```

```text filename:Output
10 50
20 30
10 30
null
[10, 20] [30, 40, 50]
[20, 30, 40]
[50, 40, 30, 20, 10]
10 -> [20, 30, 40, 50]
```

# Trap: forgetting `equals`/`hashCode`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Set<Point> raw = new HashSet<>();
        raw.add(new Point(1, 2));
        raw.add(new Point(1, 2));
        System.out.println("class without equals/hashCode: " + raw.size());

        Set<PointRec> rec = new HashSet<>();
        rec.add(new PointRec(1, 2));
        rec.add(new PointRec(1, 2));
        System.out.println("record: " + rec.size());
    }
}

class Point {                        // uses Object's identity equals/hashCode
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
}

record PointRec(int x, int y) {}     // records generate equals/hashCode from the fields
```

```text filename:Output
class without equals/hashCode: 2
record: 1
```

> [!WARNING] Watch out
>
> `TreeSet` ignores `equals` entirely and treats `compare(a, b) == 0` as “duplicate”. A comparator that only compares by, say, length will silently drop `"cat"` when `"dog"` is already present.

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Set<String> byLength = new TreeSet<>(Comparator.comparingInt(String::length));
        byLength.addAll(List.of("dog", "cat", "horse"));
        System.out.println(byLength);       // "cat" looked like a duplicate of "dog"
    }
}
```

```text filename:Output
[dog, horse]
```

```question
How does HashSet guarantee uniqueness?

---

It is a wrapper around a `HashMap` whose keys are the elements and whose values are one shared dummy `PRESENT` object. `add(e)` is `map.put(e, PRESENT) == null` — so uniqueness is exactly `HashMap` key uniqueness: same bucket via `hashCode`, then `equals`.
```

```question
HashSet vs TreeSet — which and why?

---

`HashSet` for fast O(1) membership when order doesn't matter. `TreeSet` when you need sorted iteration or range/nearest queries (`floor`, `ceiling`, `subSet`) at O(log n), and it requires comparable elements and rejects `null`.
```

```question
Can you add null to a TreeSet?

---

Not with natural ordering — `compareTo` on `null` throws `NullPointerException`. It works only with a comparator that handles nulls, e.g. `Comparator.nullsFirst(Comparator.naturalOrder())`.
```
