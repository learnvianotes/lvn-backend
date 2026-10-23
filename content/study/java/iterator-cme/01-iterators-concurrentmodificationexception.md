---
id: 6746f79e-e9c0-7afe-8a7f-537db9e5c37f
key: topic:java/iterator-cme
subject: java
topic: iterator-cme
title: Iterators & ConcurrentModificationException
slug: iterators-concurrentmodificationexception
order: 1
---

Removing from a collection while a for-each loop walks it throws `ConcurrentModificationException`. Use `removeIf`, `Iterator.remove`, or a concurrent collection.

> [!INFO]
>
> <strong>Iterator</strong> — an object with `hasNext()`, `next()` and optional `remove()` that walks a collection. The for-each loop over any `Iterable` is compiled into exactly these calls.

# Fail-fast iterators

`ArrayList`, `HashMap` and friends keep a counter `modCount`, bumped on every <em>structural</em> change (add/remove, not `set`). The iterator remembers the value when it was created and checks it on each `next()`; a mismatch throws.

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4));
        try {
            for (Integer n : nums) {
                if (n % 2 == 0) nums.remove(n);   // structural change behind the iterator's back
            }
        } catch (ConcurrentModificationException e) {
            System.out.println("ConcurrentModificationException");
        }
        System.out.println(nums);
    }
}
```

```text filename:Output
ConcurrentModificationException
[1, 3, 4]
```

> [!WARNING] Watch out
>
> Despite the name, this has nothing to do with threads — one thread modifying a collection it is iterating is enough. It is also <em>best-effort</em>: removing the second-to-last element skips the final `hasNext()` check and silently exits without an exception, so never rely on it to catch bugs.

# Three correct ways to remove

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> a = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
        a.removeIf(n -> n % 2 == 0);                  // 1. simplest (Java 8+)
        System.out.println(a);

        List<Integer> b = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
        for (Iterator<Integer> it = b.iterator(); it.hasNext(); ) {
            if (it.next() % 2 == 0) it.remove();      // 2. the iterator's own remove
        }
        System.out.println(b);

        List<Integer> c = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
        for (int i = c.size() - 1; i >= 0; i--) {     // 3. index loop, backwards
            if (c.get(i) % 2 == 0) c.remove(i);
        }
        System.out.println(c);

        Map<String, Integer> m = new HashMap<>(Map.of("a", 1, "b", 2));
        m.entrySet().removeIf(e -> e.getValue() > 1); // maps: remove through a view
        System.out.println(m);
    }
}
```

```text filename:Output
[1, 3, 5]
[1, 3, 5]
[1, 3, 5]
{a=1}
```

# `ListIterator` — both directions, edit in place

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> words = new ArrayList<>(List.of("a", "b", "c"));
        ListIterator<String> it = words.listIterator();
        while (it.hasNext()) {
            int i = it.nextIndex();
            String w = it.next();
            if (w.equals("b")) {
                it.set("B");          // replace the element just returned
                it.add("b2");         // insert after it
            }
            System.out.print(i + ":" + w + " ");   // "c" is now at index 3
        }
        System.out.println();
        while (it.hasPrevious()) System.out.print(it.previous() + " ");
        System.out.println();
    }
}
```

```text filename:Output
0:a 1:b 3:c
c b2 B a
```

# Fail-safe (snapshot / weakly consistent) iterators

```java filename:Java
import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> cow = new CopyOnWriteArrayList<>(List.of(1, 2, 3));
        for (Integer n : cow) {
            if (n == 1) cow.add(99);      // iterator walks a snapshot — no exception
            System.out.print(n + " ");
        }
        System.out.println("-> " + cow);

        Map<Integer, String> chm = new ConcurrentHashMap<>(Map.of(1, "a", 2, "b"));
        for (Integer k : chm.keySet()) chm.remove(k);   // allowed
        System.out.println(chm);
    }
}
```

```text filename:Output
1 2 3 -> [1, 2, 3, 99]
{}
```

|  | Fail-fast | Fail-safe / weakly consistent |
| --- | --- | --- |
| Examples | `ArrayList`, `HashMap`, `HashSet` | `CopyOnWriteArrayList`, `ConcurrentHashMap` |
| Modify while iterating | Throws `ConcurrentModificationException` | Allowed |
| Sees changes made during iteration? | — | COW: never (snapshot); CHM: maybe |
| Cost | None | COW copies the whole array on every write |

```question
What causes ConcurrentModificationException and how do you avoid it?

---

A fail-fast iterator notices `modCount` changed by something other than itself — typically `list.remove(x)` inside a for-each loop. Avoid it with `removeIf`, `Iterator.remove()`, collecting items to remove and calling `removeAll` afterwards, iterating over a copy, or using a concurrent collection.
```

```question
Fail-fast vs fail-safe iterators?

---

Fail-fast iterators (most `java.util` collections) throw on concurrent structural modification. Fail-safe ones (`java.util.concurrent`) never throw: `CopyOnWriteArrayList` iterates a snapshot, `ConcurrentHashMap` is weakly consistent — it reflects some, maybe all, changes made after the iterator was created.
```

```question
Iterator vs ListIterator?

---

`Iterator` works on any collection, forward only, with `remove`. `ListIterator` is for lists: moves both ways (`previous`), knows indices (`nextIndex`), and can `set` and `add` at the cursor.
```
