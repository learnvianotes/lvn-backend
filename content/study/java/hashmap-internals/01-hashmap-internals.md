---
id: 64c65bb0-e84d-74c3-b0a3-0bcf1fe7d98f
key: topic:java/hashmap-internals
subject: java
topic: hashmap-internals
title: HashMap Internals
slug: hashmap-internals
order: 1
---

An array of buckets indexed by the key's hash: O(1) average `get`/`put`, as long as `hashCode` spreads keys well and keys never change while inside.

> [!INFO]
>
> <strong>HashMap</strong> — a hash table storing `Node<K,V>` entries (`hash`, `key`, `value`, `next`) in an array `table`. Allows one `null` key and `null` values; not thread-safe; iteration order unspecified.

# How `put(k, v)` works

1. <strong>Hash the key</strong>

   `h = key.hashCode()`, then <em>spread</em> it: `h ^ (h >>> 16)` so the high bits influence the bucket too. A `null` key always hashes to 0.

2. <strong>Pick the bucket</strong>

   `index = (n - 1) & hash` — `n` (the table length) is always a power of two, so this is a fast `hash % n`.

3. <strong>Empty bucket?</strong>

   Store a new node there.

4. <strong>Collision</strong>

   Walk the bucket: if a node has the same `hash` <strong>and</strong> (`==` or `equals`) key, replace its value and return the old one. Otherwise append a new node.

5. <strong>Treeify</strong>

   If one bucket reaches <strong>8</strong> nodes (and the table has at least <strong>64</strong> buckets) the list becomes a red-black tree → worst case O(log n) instead of O(n). It turns back into a list at 6.

6. <strong>Resize</strong>

   If `size > capacity × loadFactor` (16 × 0.75 = 12 by default), the table doubles and entries are split between index `i` and `i + oldCap`.

| Parameter | Default | Meaning |
| --- | --- | --- |
| Initial capacity | 16 (allocated lazily on first `put`) | Always rounded up to a power of two |
| Load factor | 0.75 | Time/space trade-off: resize when 75% full |
| `TREEIFY_THRESHOLD` | 8 | Bucket list → tree (Java 8+) |
| `UNTREEIFY_THRESHOLD` | 6 | Tree → list after shrinking |
| `MIN_TREEIFY_CAPACITY` | 64 | Below this, resize instead of treeifying |

# Seeing the bucket index

```java filename:Java
public class Main {
    static int spread(Object key) {
        int h;
        return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    }

    public static void main(String[] args) {
        int n = 16;
        for (Object k : new Object[]{"Aa", "BB", 17, 33, null}) {
            int h = spread(k);
            System.out.println(k + " hashCode=" + (k == null ? 0 : k.hashCode()) + " bucket=" + ((n - 1) & h));
        }
    }
}
```

```text filename:Output
Aa hashCode=2112 bucket=0
BB hashCode=2112 bucket=0
17 hashCode=17 bucket=1
33 hashCode=33 bucket=1
null hashCode=0 bucket=0
```

> [!NOTE] Key point
>
> `"Aa"` and `"BB"` have the <em>same</em> `hashCode` (2112) — a classic collision. Both still live in the map: the bucket holds a chain, and `equals` tells them apart.

# The modern Map API

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> count = new TreeMap<>();     // TreeMap only to print in sorted order
        for (String w : "to be or not to be".split(" ")) {
            count.merge(w, 1, Integer::sum);             // insert 1, or add 1 to the old value
        }
        System.out.println(count);
        System.out.println(count.getOrDefault("xyz", 0));

        Map<String, List<String>> groups = new TreeMap<>();
        for (String w : List.of("apple", "avocado", "banana")) {
            groups.computeIfAbsent(w.substring(0, 1), k -> new ArrayList<>()).add(w);
        }
        System.out.println(groups);

        System.out.println(count.putIfAbsent("be", 100) + " " + count.putIfAbsent("new", 100));
        count.computeIfPresent("or", (k, v) -> null);   // returning null removes the entry
        System.out.println(count);

        for (Map.Entry<String, Integer> e : count.entrySet()) {
            if (e.getValue() > 1) System.out.print(e.getKey() + " ");
        }
        System.out.println();
    }
}
```

```text filename:Output
{be=2, not=1, or=1, to=2}
0
{a=[apple, avocado], b=[banana]}
2 null
{be=2, new=100, not=1, to=2}
be new to
```

| Method | Does |
| --- | --- |
| `getOrDefault(k, d)` | Value, or `d` if absent |
| `putIfAbsent(k, v)` | Put only if absent; returns the existing value (or `null`) |
| `computeIfAbsent(k, fn)` | Create the value lazily — perfect for multimaps `Map<K, List<V>>` |
| `computeIfPresent(k, fn)` | Update an existing value; `null` result removes it |
| `merge(k, v, fn)` | Put `v`, or combine with the old value — counters: `merge(k, 1, Integer::sum)` |
| `entrySet()` | Iterate keys and values together — cheaper than `keySet()` + `get` |

# Trap: mutating a key

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<List<Integer>, String> map = new HashMap<>();
        List<Integer> key = new ArrayList<>(List.of(1, 2));
        map.put(key, "found");
        key.add(3);                                  // hashCode of the key changes
        System.out.println(map.get(key));            // looks in the wrong bucket
        System.out.println(map.get(List.of(1, 2)));  // right bucket, but equals fails
        System.out.println(map.size());              // the entry is stuck in the map
    }
}
```

```text filename:Output
null
null
1
```

> [!WARNING] Watch out
>
> Keys must be effectively <strong>immutable</strong> while they are in a `HashMap`/`HashSet`. `String`, `Integer` and records of immutable fields are ideal keys.

# `equals` / `hashCode` contract

- If `a.equals(b)` then `a.hashCode() == b.hashCode()` — <strong>required</strong>. Break it and lookups miss.
- Equal hash codes do <em>not</em> imply `equals` (collisions are legal, just slower).
- Override both or neither. `hashCode` must be stable while the object is used as a key.

```question
What happens on a hash collision in HashMap?

---

Both entries go into the same bucket: as a linked list (new node appended at the tail since Java 8), or as a red-black tree once the bucket holds 8+ nodes and capacity ≥ 64. Lookup compares `hash`, then `==`/`equals` on each node in the bucket.
```

```question
Why is HashMap capacity always a power of two?

---

So the bucket index can be computed with a cheap bitmask `(n - 1) & hash` instead of `%`, and so on resize each entry either stays at index `i` or moves to `i + oldCap` (decided by one bit). The `h ^ (h >>> 16)` spreading compensates for only the low bits being used.
```

```question
HashMap vs Hashtable vs ConcurrentHashMap?

---

`HashMap`: unsynchronised, one `null` key and `null` values allowed. `Hashtable`: legacy, every method synchronised on one lock, no nulls. `ConcurrentHashMap`: thread-safe with CAS + per-bin locking, lock-free reads, no nulls (so `get` returning `null` unambiguously means absent).
```

```question
What is the time complexity of HashMap get?

---

O(1) average. Worst case O(n) for a bucket that is a list (all keys colliding), improved to O(log n) since Java 8 when the bucket is treeified (keys that are `Comparable` get the full benefit).
```
