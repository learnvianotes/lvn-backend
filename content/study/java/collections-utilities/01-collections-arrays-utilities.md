---
id: 2ec55f5e-1a88-7da8-b70e-70a62efee415
key: topic:java/collections-utilities
subject: java
topic: collections-utilities
title: Collections & Arrays Utilities
slug: collections-arrays-utilities
order: 1
---

`java.util.Collections` and `java.util.Arrays` are static toolboxes — sorting, searching, filling, copying, wrapping. Knowing them saves writing (and debugging) loops.

# `Collections` algorithms

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> xs = new ArrayList<>(List.of(5, 3, 9, 1, 3));
        Collections.sort(xs);
        System.out.println(xs + " binarySearch(5)=" + Collections.binarySearch(xs, 5)
                + " binarySearch(4)=" + Collections.binarySearch(xs, 4));
        Collections.reverse(xs);
        System.out.println(xs + " max=" + Collections.max(xs) + " min=" + Collections.min(xs));
        System.out.println("frequency(3)=" + Collections.frequency(xs, 3));
        Collections.swap(xs, 0, 4);
        System.out.println(xs);
        Collections.rotate(xs, 1);
        System.out.println(xs);
        Collections.shuffle(xs, new Random(42));   // seeded -> reproducible
        System.out.println(xs);
        System.out.println(Collections.nCopies(3, "ab") + " " + String.join("", Collections.nCopies(3, "-")));
        System.out.println(Collections.disjoint(List.of(1, 2), List.of(3, 4)));
    }
}
```

```text filename:Output
[1, 3, 3, 5, 9] binarySearch(5)=3 binarySearch(4)=-4
[9, 5, 3, 3, 1] max=9 min=1
frequency(3)=2
[1, 5, 3, 3, 9]
[9, 1, 5, 3, 3]
[1, 5, 3, 3, 9]
[ab, ab, ab] ---
true
```

> [!NOTE] Key point
>
> `binarySearch` returns `-(insertionPoint) - 1` when the key is missing: `4` would be inserted at index 3, so the result is `-4`. The list must already be sorted in the same order.

# Wrappers and empty collections

| Method | Returns |
| --- | --- |
| `Collections.unmodifiableList(l)` (…`Set`, `Map`) | Read-only <strong>view</strong> — still reflects changes to `l` |
| `Collections.synchronizedList(l)` (…`Map`) | Every method locked on one mutex; iterate inside `synchronized (list) { … }` |
| `Collections.emptyList()` / `emptyMap()` | Shared immutable empty instance |
| `Collections.singletonList(x)` | Immutable one-element list |
| `Collections.addAll(c, a, b, c)` | Add varargs to any collection |

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> src = new ArrayList<>(List.of("a"));
        List<String> view = Collections.unmodifiableList(src);
        List<String> copy = List.copyOf(src);
        src.add("b");
        System.out.println(view + " " + copy);   // the view sees the change, the copy doesn't
        try {
            view.add("c");
        } catch (UnsupportedOperationException e) {
            System.out.println("view is read-only");
        }
    }
}
```

```text filename:Output
[a, b] [a]
view is read-only
```

# `Arrays` helpers

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        int[] a = {5, 2, 8, 1};
        Arrays.sort(a);
        System.out.println(Arrays.toString(a) + " idx(5)=" + Arrays.binarySearch(a, 5));

        int[] filled = new int[4];
        Arrays.fill(filled, -1);
        System.out.println(Arrays.toString(filled));

        int[] bigger = Arrays.copyOf(a, 6);            // pads with 0
        int[] slice = Arrays.copyOfRange(a, 1, 3);     // [1, 3)
        System.out.println(Arrays.toString(bigger) + " " + Arrays.toString(slice));

        System.out.println(Arrays.stream(a).sum() + " " + Arrays.stream(a).max().getAsInt());
        System.out.println(Arrays.equals(a, new int[]{1, 2, 5, 8}) + " " + (a == a.clone()));

        int[][] grid = {{1, 2}, {3, 4}};
        System.out.println(Arrays.deepToString(grid));

        Integer[] boxed = {3, 1, 2};
        Arrays.sort(boxed, Collections.reverseOrder()); // comparators need object arrays
        System.out.println(Arrays.toString(boxed));
    }
}
```

```text filename:Output
[1, 2, 5, 8] idx(5)=2
[-1, -1, -1, -1]
[1, 2, 5, 8, 0, 0] [2, 5]
16 8
true false
[[1, 2], [3, 4]]
[3, 2, 1]
```

> [!NOTE] Key point
>
> `Arrays.sort(int[])` uses dual-pivot quicksort (not stable, but stability is meaningless for primitives); `Arrays.sort(Object[])` uses stable TimSort. Primitive arrays can't take a `Comparator` — box them or sort then reverse.

# Trap: `Arrays.asList`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        String[] arr = {"x", "y", "z"};
        List<String> fixed = Arrays.asList(arr);   // fixed-size view over the array
        fixed.set(0, "X");                          // allowed, writes through
        System.out.println(Arrays.toString(arr));
        try {
            fixed.add("w");
        } catch (UnsupportedOperationException e) {
            System.out.println("add -> UnsupportedOperationException");
        }

        int[] prim = {1, 2, 3};
        System.out.println(Arrays.asList(prim).size());      // List<int[]> with ONE element
        System.out.println(Arrays.asList(1, 2, 3).size());   // varargs of Integer

        List<String> growable = new ArrayList<>(Arrays.asList(arr));
        growable.add("w");
        System.out.println(growable);
    }
}
```

```text filename:Output
[X, y, z]
add -> UnsupportedOperationException
1
3
[X, y, z, w]
```

> [!WARNING] Watch out
>
> `Arrays.asList` returns a fixed-size list backed by the array (no `add`/`remove`), and `Arrays.asList(intArray)` gives a `List<int[]>` of size 1. Wrap it in `new ArrayList<>(…)` for a normal list; use `Arrays.stream(ints).boxed().toList()` for primitives.

```question
What does Collections.synchronizedList not protect you from?

---

Compound actions and iteration. Each single call is locked, but `if (!list.contains(x)) list.add(x)` can interleave between threads, and iterating requires manually holding `synchronized (list)`. Prefer `java.util.concurrent` collections.
```

```question
unmodifiableList vs List.copyOf vs List.of?

---

`unmodifiableList` is a read-only <em>view</em> — changes to the backing list show through. `List.copyOf` makes an independent immutable copy (returns the argument itself if it is already an immutable list). `List.of` builds an immutable list from values. Neither of the last two allows `null`s.
```

```question
Which sort algorithms does Java use?

---

`Arrays.sort` on primitives: dual-pivot quicksort, O(n log n) average, not stable. On objects and in `Collections.sort`/`List.sort`: TimSort — a stable merge/insertion hybrid, O(n log n) worst case and O(n) on already-sorted data.
```
