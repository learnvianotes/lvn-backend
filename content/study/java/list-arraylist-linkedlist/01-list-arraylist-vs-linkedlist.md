---
id: f9650a12-1002-7f7d-9e6a-a09da51b1ae2
key: topic:java/list-arraylist-linkedlist
subject: java
topic: list-arraylist-linkedlist
title: "List: ArrayList vs LinkedList"
slug: list-arraylist-vs-linkedlist
order: 1
---

`ArrayList` is a resizable array and is the right default \~99% of the time; `LinkedList` is a doubly-linked list that only wins when you add/remove at an iterator's position.

> [!INFO]
>
> <strong>List</strong> — an ordered collection with positional access (`get(i)`, `set(i, x)`, `add(i, x)`, `remove(i)`), `indexOf`, and duplicates allowed.

# How `ArrayList` grows

- Backed by an `Object[] elementData`; `size` counts the slots actually used.
- `new ArrayList<>()` starts with an <em>empty</em> shared array; the first `add` allocates capacity <strong>10</strong>.
- When full, it grows to `old + old/2` (<strong>1.5×</strong>) and copies with `Arrays.copyOf` — O(n) once, so `add` is <strong>amortised O(1)</strong>.
- Pre-size with `new ArrayList<>(expected)` or `ensureCapacity(n)` to avoid repeated copying; `trimToSize()` releases the slack.

`capacity: 10 → 15 → 22 → 33 → 49 → 73 → …`

# Complexity

| Operation | `ArrayList` | `LinkedList` |
| --- | --- | --- |
| `get(i)` / `set(i, x)` | <strong>O(1)</strong> | O(n) — walks from the nearer end |
| `add(x)` at the end | O(1) amortised | O(1) |
| `add(0, x)` / `remove(0)` | O(n) — shifts elements | <strong>O(1)</strong> |
| Insert/remove in the middle | O(n) shift | O(n) to <em>find</em> + O(1) to link |
| `contains` / `indexOf` | O(n) | O(n) |
| Memory per element | one reference (4–8 bytes) | node object: item + prev + next + header (\~24–40 bytes) |
| CPU cache | Contiguous — very fast to scan | Pointer chasing — slow |

> [!NOTE] Key point
>
> Even the “LinkedList wins at insert-in-the-middle” case usually loses in practice: finding the position is O(n) pointer-chasing, while `ArrayList` shifts with a single fast `System.arraycopy`. For a queue or stack use `ArrayDeque`, not `LinkedList`.

# Everyday operations

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>(List.of("b", "c"));
        list.add(0, "a");               // insert at index
        list.add("d");
        list.set(3, "D");               // replace
        System.out.println(list + " get(1)=" + list.get(1));
        System.out.println(list.indexOf("c") + " " + list.contains("z"));
        list.remove("a");               // by value
        System.out.println(list);

        LinkedList<Integer> linked = new LinkedList<>(List.of(2, 3));
        linked.addFirst(1);
        linked.addLast(4);
        System.out.println(linked + " first=" + linked.getFirst() + " last=" + linked.peekLast());
    }
}
```

```text filename:Output
[a, b, c, D] get(1)=b
2 false
[b, c, D]
[1, 2, 3, 4] first=1 last=4
```

# Trap: `remove(int)` vs `remove(Object)`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(10, 20, 30, 1));
        nums.remove(1);                     // remove(int index) — removes 20!
        System.out.println(nums);
        nums.remove(Integer.valueOf(1));    // remove(Object) — removes the value 1
        System.out.println(nums);
    }
}
```

```text filename:Output
[10, 30, 1]
[10, 30]
```

> [!WARNING] Watch out
>
> With a `List<Integer>`, `remove(1)` picks the <em>more specific</em> overload `remove(int index)` — no boxing needed — so it deletes by position. Pass `Integer.valueOf(x)` (or `(Integer) x`) to delete by value.

# `subList` is a view

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5));
        List<Integer> mid = list.subList(1, 4);   // [1, 4) — a live window
        mid.set(0, 99);
        System.out.println(list);
        list.subList(0, 2).clear();               // idiom: delete a range
        System.out.println(list);
        try {
            System.out.println(mid);              // parent was structurally modified
        } catch (ConcurrentModificationException e) {
            System.out.println("stale subList -> ConcurrentModificationException");
        }
    }
}
```

```text filename:Output
[0, 99, 2, 3, 4, 5]
[2, 3, 4, 5]
stale subList -> ConcurrentModificationException
```

> [!WARNING] Watch out
>
> A `subList` writes through to its parent and becomes invalid once the parent is structurally changed through any other path. Copy it (`new ArrayList<>(list.subList(a, b))`) if you need to keep it.

```question
ArrayList vs LinkedList — when would you pick LinkedList?

---

Almost never. Only when you do many insertions/removals <em>at an iterator's current position</em> (`ListIterator.add/remove`) on a long list, or need the `Deque` methods on a list. Random access is O(n), and each node costs \~3–5× the memory. `ArrayDeque` beats it as a queue.
```

```question
What is the default capacity of ArrayList and how does it grow?

---

Capacity 10 allocated lazily on the first `add` (the no-arg constructor starts with an empty array). When full it grows by 50% (`newCapacity = old + (old >> 1)`) and copies the array, giving amortised O(1) appends.
```

```question
ArrayList vs Vector?

---

Both are resizable arrays. `Vector` synchronises every method (slow, and still not safe for compound actions like check-then-add) and doubles its size when growing; `ArrayList` is unsynchronised and grows by 1.5×. Use `ArrayList`, or `CopyOnWriteArrayList` / `Collections.synchronizedList` for threads.
```
