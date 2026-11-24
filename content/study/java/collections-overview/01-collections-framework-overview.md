---
id: cf3a0c08-a955-794e-bd49-44f6b8131a2b
key: topic:java/collections-overview
subject: java
topic: collections-overview
title: Collections Framework Overview
slug: collections-framework-overview
order: 1
---

A unified set of interfaces (`List`, `Set`, `Queue`, `Map`) and ready-made implementations — pick the interface for the <em>behaviour</em> you need, then the class for the <em>performance</em> you need.

> [!INFO]
>
> <strong>Java Collections Framework (JCF)</strong> — the `java.util` interfaces, implementations and algorithms for storing groups of objects. Collections hold <strong>references to objects</strong> only — primitives are autoboxed (`List<Integer>`, never `List<int>`).

# The hierarchy

`Iterable<T>` → `Collection<E>` → `List` / `Set` / `Queue`

- `Iterable` — anything usable in a for-each loop (`iterator()`, `forEach`).
- `Collection` — `add`, `remove`, `contains`, `size`, `isEmpty`, `stream()`, `removeIf`.
- `List` — ordered, index-based, duplicates allowed: `ArrayList`, `LinkedList`, (`Vector`, `Stack` — legacy).
- `Set` — no duplicates: `HashSet`, `LinkedHashSet`, `TreeSet` (`SortedSet` → `NavigableSet`).
- `Queue` / `Deque` — ends-oriented: `ArrayDeque`, `LinkedList`, `PriorityQueue`.
- `Map<K, V>` — key → value pairs. <strong>Not</strong> a `Collection`: `HashMap`, `LinkedHashMap`, `TreeMap`, (`Hashtable` — legacy).

> [!NOTE] Key point
>
> `Map` does not extend `Collection` — a map is a set of <em>entries</em>, not of elements. You view it as collections through `keySet()`, `values()` and `entrySet()`.

# Choosing a collection

| Need | Use | Why |
| --- | --- | --- |
| Ordered list, fast random access | `ArrayList` | Array-backed, O(1) `get(i)`, cache-friendly |
| Stack or queue | `ArrayDeque` | O(1) at both ends, faster than `Stack` / `LinkedList` |
| Unique elements, no order | `HashSet` | O(1) average `add`/`contains` |
| Unique, insertion order | `LinkedHashSet` | Hash lookup + linked list of entries |
| Unique, sorted / range queries | `TreeSet` | Red-black tree, O(log n), `floor`/`ceiling` |
| Key → value lookup | `HashMap` | O(1) average |
| Keys in insertion / access order, LRU | `LinkedHashMap` | Predictable iteration, `removeEldestEntry` |
| Sorted keys, nearest-key queries | `TreeMap` | O(log n), `floorKey`, `subMap` |
| Always get the min / max next | `PriorityQueue` | Binary heap: O(log n) `offer`/`poll`, O(1) `peek` |
| Thread-safe map | `ConcurrentHashMap` | Fine-grained locking, no `null`s |

# Program to the interface

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();   // declare the interface type
        names.add("Asha");
        names.add("Ravi");
        names.add("Asha");                        // duplicates are fine in a List
        System.out.println(names + " size=" + names.size());

        Set<String> unique = new TreeSet<>(names); // copy constructor: every collection has one
        System.out.println(unique);

        Map<String, Integer> ages = new HashMap<>();
        ages.put("Asha", 30);
        ages.put("Asha", 31);                      // same key: value replaced
        System.out.println(ages);
    }
}
```

```text filename:Output
[Asha, Ravi, Asha] size=3
[Asha, Ravi]
{Asha=31}
```

Declaring `List<String> names` (not `ArrayList<String>`) lets you swap the implementation later without touching the callers.

# Immutable factories: `List.of`, `Set.of`, `Map.of` (Java 9+)

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = List.of(3, 1, 2);
        Map<String, Integer> m = Map.of("a", 1);
        System.out.println(nums + " " + m);
        try {
            nums.add(4);
        } catch (UnsupportedOperationException e) {
            System.out.println("add -> UnsupportedOperationException");
        }
        try {
            List.of("x", null);
        } catch (NullPointerException e) {
            System.out.println("null element -> NullPointerException");
        }
        try {
            Set.of(1, 1);
        } catch (IllegalArgumentException e) {
            System.out.println("duplicate -> " + e.getMessage());
        }
        List<Integer> copy = List.copyOf(new ArrayList<>(nums)); // immutable snapshot
        System.out.println(copy);
    }
}
```

```text filename:Output
[3, 1, 2] {a=1}
add -> UnsupportedOperationException
null element -> NullPointerException
duplicate -> duplicate element: 1
[3, 1, 2]
```

|  | `List.of(...)` | `Arrays.asList(...)` | `Collections.unmodifiableList(l)` |
| --- | --- | --- | --- |
| Add / remove | Throws | Throws (fixed size) | Throws |
| `set(i, x)` | Throws | <strong>Allowed</strong> (writes through to the array) | Throws |
| `null` elements | Rejected | Allowed | Allowed |
| Sees later changes to the source? | No source | Yes (backed by the array) | <strong>Yes</strong> — it is only a read-only <em>view</em> |

> [!WARNING] Watch out
>
> `Set.of` and `Map.of` have a deliberately <em>randomised</em> iteration order that can change between JVM runs — never rely on it. `Map.of` accepts up to 10 pairs; use `Map.ofEntries(Map.entry(k, v), …)` for more.

# Legacy classes

| Legacy | Problem | Modern replacement |
| --- | --- | --- |
| `Vector` | Every method `synchronized` — slow even single-threaded | `ArrayList` (or `CopyOnWriteArrayList`) |
| `Stack` | Extends `Vector`; exposes `get(i)`, `insertElementAt` | `ArrayDeque` (`push`/`pop`/`peek`) |
| `Hashtable` | Global lock, no `null` keys/values | `HashMap` / `ConcurrentHashMap` |
| `Enumeration` | No `remove`, clunky names | `Iterator` |

```question
Why doesn't Map extend Collection?

---

A `Collection` is a group of single elements with `add(E)`. A map stores <em>pairs</em> and its core operation is `put(K, V)`; forcing it into `Collection` would give methods with no sensible meaning. Instead a map exposes three collection <em>views</em>: `keySet()`, `values()`, `entrySet()`.
```

```question
Collection vs Collections?

---

`Collection` is the root <strong>interface</strong> of lists, sets and queues. `Collections` is a <strong>utility class</strong> of static helpers — `sort`, `reverse`, `unmodifiableList`, `synchronizedMap`, `emptyList`… (Similarly `Array` vs `Arrays`.)
```

```question
Why can't a collection hold int?

---

Generics work only with reference types (type erasure turns `T` into `Object`). Primitives are autoboxed to `Integer` etc. — which costs memory and time. For huge numeric data use arrays or `IntStream`.
```
