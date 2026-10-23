---
id: 3d1cfca9-663c-79ae-81af-2c4dfea80fc3
key: topic:java/linkedhashmap-treemap
subject: java
topic: linkedhashmap-treemap
title: LinkedHashMap & TreeMap
slug: linkedhashmap-treemap
order: 1
---

`LinkedHashMap` = `HashMap` + a doubly-linked list for predictable order (and a two-line LRU cache). `TreeMap` = a red-black tree for sorted keys and nearest-key queries.

# Map implementations compared

|  | `HashMap` | `LinkedHashMap` | `TreeMap` | `Hashtable` |
| --- | --- | --- | --- | --- |
| Order | None | Insertion (or access) | Sorted by key | None |
| `get` / `put` | O(1) avg | O(1) avg | O(log n) | O(1) avg |
| `null` key | One | One | No (natural order) | No |
| `null` values | Yes | Yes | Yes | No |
| Thread-safe | No | No | No | Yes (coarse lock) |
| Key requirement | `equals`/`hashCode` | `equals`/`hashCode` | `Comparable`/`Comparator` | `equals`/`hashCode` |
| Use for | Default map | Stable order, LRU caches | Sorted output, ranges, floor/ceiling | Nothing new — legacy |

# `LinkedHashMap` orders

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> ins = new LinkedHashMap<>();
        ins.put("banana", 2);
        ins.put("apple", 1);
        ins.put("cherry", 3);
        ins.put("banana", 20);          // re-put does NOT move the key
        System.out.println(ins);

        // accessOrder = true: every get/put moves the entry to the end
        Map<String, Integer> acc = new LinkedHashMap<>(16, 0.75f, true);
        acc.putAll(Map.of("a", 1));
        acc.put("b", 2);
        acc.put("c", 3);
        acc.get("a");
        System.out.println(acc);
    }
}
```

```text filename:Output
{banana=20, apple=1, cherry=3}
{b=2, c=3, a=1}
```

# LRU cache in a few lines

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        LruCache<Integer, String> cache = new LruCache<>(2);
        cache.put(1, "one");
        cache.put(2, "two");
        cache.get(1);                 // 1 is now most recently used
        cache.put(3, "three");        // evicts 2, the least recently used
        System.out.println(cache.keySet());
    }
}

class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LruCache(int capacity) {
        super(16, 0.75f, true);       // access order
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;     // called after every put
    }
}
```

```text filename:Output
[1, 3]
```

> [!NOTE] Key point
>
> This is the standard answer to “design an LRU cache” in Java. The from-scratch version (a `HashMap` of nodes + your own doubly-linked list) has the same O(1) `get`/`put`.

# `TreeMap` as a `NavigableMap`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        TreeMap<Integer, String> grades = new TreeMap<>();
        grades.put(90, "A");
        grades.put(80, "B");
        grades.put(70, "C");
        grades.put(0, "F");

        int score = 84;
        System.out.println(score + " -> " + grades.floorEntry(score).getValue());
        System.out.println(grades.firstKey() + " " + grades.lastKey());
        System.out.println(grades.floorKey(75) + " " + grades.ceilingKey(75));
        System.out.println(grades.ceilingEntry(95));             // no key >= 95
        System.out.println(grades.headMap(80));                  // keys < 80
        System.out.println(grades.subMap(70, true, 90, false));  // [70, 90)
        System.out.println(grades.descendingMap());
    }
}
```

```text filename:Output
84 -> B
0 90
70 80
null
{0=F, 70=C}
{70=C, 80=B}
{90=A, 80=B, 70=C, 0=F}
```

| Method | Returns |
| --- | --- |
| `floorKey(k)` / `floorEntry(k)` | Greatest key `<= k` |
| `ceilingKey(k)` / `ceilingEntry(k)` | Least key `>= k` |
| `lowerKey(k)` / `higherKey(k)` | Strictly `< k` / `> k` |
| `firstEntry()` / `pollFirstEntry()` | Smallest (and remove it) |
| `headMap(k)` / `tailMap(k)` / `subMap(a, b)` | Live range views |
| `descendingMap()` | Reverse-order view |

> [!WARNING] Watch out
>
> All the `floor`/`ceiling` methods return `null` when no such key exists — unboxing that `null` into an `int` throws `NullPointerException`.

```question
How would you implement an LRU cache in Java?

---

Extend `LinkedHashMap` with `accessOrder = true` and override `removeEldestEntry` to return `size() > capacity`. Access order moves each touched entry to the tail; the eldest (head) is the least recently used and is evicted after a `put`. For thread safety wrap it or use a library such as Caffeine.
```

```question
When would you choose TreeMap over HashMap?

---

When you need keys in sorted order or queries like “nearest key below x” (`floorKey`), “all keys in a range” (`subMap`), min/max key — e.g. time-series lookups, interval scheduling, leaderboard ranges. The cost is O(log n) per operation instead of O(1).
```

```question
What internal structure does TreeMap use?

---

A red-black tree — a self-balancing binary search tree whose height stays ≤ 2·log₂(n+1), guaranteeing O(log n) `get`, `put`, `remove`. Ordering comes from `compareTo` or the supplied `Comparator`; `equals` is not used.
```
