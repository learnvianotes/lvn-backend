---
id: db8db7e2-53d7-7fd9-9312-41db317829f8
key: topic:java/arrays
subject: java
topic: arrays
title: Arrays
slug: arrays
order: 1
---

A fixed-size, zero-indexed, contiguous container of one element type. Arrays are objects: they live on the heap and know their `length`.

> [!INFO]
>
> <strong>Array</strong> — an object holding `length` elements of the same type, accessed by index `0 … length-1` in O(1). Its size is fixed at creation; bounds are checked at runtime.

# Declaring and creating

```java filename:Java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] a = new int[4];                  // all zeros
        int[] b = {5, 3, 9};                   // array initializer
        String[] names = new String[2];        // all null
        boolean[] flags = new boolean[2];      // all false
        double[] d = new double[]{1.5, 2.5};

        a[0] = 42;
        System.out.println(Arrays.toString(a) + " len=" + a.length);
        System.out.println(Arrays.toString(b) + " " + Arrays.toString(names) + " " + Arrays.toString(flags) + " " + Arrays.toString(d));
        System.out.println(b);                 // prints type@hash — not the contents!
    }
}
```

The last line prints something like `[I@1b6d3586` — `[I` means “array of int”. Always print arrays with `Arrays.toString` (or `Arrays.deepToString` for nested arrays).

| Element type | Default value |
| --- | --- |
| `byte`, `short`, `int`, `long` | `0` |
| `float`, `double` | `0.0` |
| `char` | `'\u0000'` |
| `boolean` | `false` |
| Any reference type | `null` |

# 2D and jagged arrays

```java filename:Java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[][] grid = new int[2][3];          // 2 rows × 3 columns
        grid[1][2] = 7;
        System.out.println(Arrays.deepToString(grid));

        int[][] jagged = new int[3][];         // rows created separately
        for (int i = 0; i < jagged.length; i++) {
            jagged[i] = new int[i + 1];
            Arrays.fill(jagged[i], i);
        }
        System.out.println(Arrays.deepToString(jagged));

        int[][] m = {{1, 2}, {3, 4}};
        int total = 0;
        for (int[] row : m) for (int x : row) total += x;
        System.out.println("total=" + total + " rows=" + m.length + " cols=" + m[0].length);
    }
}
```

```text filename:Output
[[0, 0, 0], [0, 0, 7]]
[[0], [1, 1], [2, 2, 2]]
total=10 rows=2 cols=2
```

# The `java.util.Arrays` toolbox

```java filename:Java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] a = {5, 2, 8, 1, 9};
        Arrays.sort(a);                                        // dual-pivot quicksort for primitives
        System.out.println(Arrays.toString(a));
        System.out.println(Arrays.binarySearch(a, 8));         // array must be sorted
        int[] bigger = Arrays.copyOf(a, 7);                    // pads with zeros
        int[] mid = Arrays.copyOfRange(a, 1, 3);
        System.out.println(Arrays.toString(bigger) + " " + Arrays.toString(mid));

        int[] x = {1, 2}, y = {1, 2};
        System.out.println((x == y) + " " + x.equals(y) + " " + Arrays.equals(x, y));

        Integer[] boxed = {3, 1, 2};
        Arrays.sort(boxed, (p, q) -> q - p);                   // comparator needs objects
        System.out.println(Arrays.toString(boxed));
        System.out.println(Arrays.stream(a).sum() + " " + Arrays.stream(a).max().getAsInt());
    }
}
```

```text filename:Output
[1, 2, 5, 8, 9]
3
[1, 2, 5, 8, 9, 0, 0] [2, 5]
false false true
[3, 2, 1]
25 9
```

> [!WARNING] Watch out
>
> `array.equals(other)` is inherited from `Object` — it compares references. Use `Arrays.equals` (or `Arrays.deepEquals` for 2D).

# `Arrays.asList` pitfalls

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        String[] arr = {"a", "b", "c"};
        List<String> view = Arrays.asList(arr);     // fixed-size view backed by arr
        view.set(0, "z");
        System.out.println(arr[0]);                  // the array changed too
        try {
            view.add("d");
        } catch (UnsupportedOperationException e) {
            System.out.println("cannot add: " + e.getClass().getSimpleName());
        }

        int[] prim = {1, 2, 3};
        System.out.println(Arrays.asList(prim).size());   // List<int[]> with ONE element
        List<String> copy = new ArrayList<>(Arrays.asList(arr));   // real, growable list
        copy.add("d");
        System.out.println(copy);
    }
}
```

```text filename:Output
z
cannot add: UnsupportedOperationException
1
[z, b, c, d]
```

# Arrays are covariant (a design flaw)

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Object[] objs = new String[2];      // compiles: String[] is an Object[]
        objs[0] = "fine";
        try {
            objs[1] = 42;                   // runtime check fails
        } catch (ArrayStoreException e) {
            System.out.println("ArrayStoreException: " + e.getMessage());
        }
    }
}
```

```text filename:Output
ArrayStoreException: java.lang.Integer
```

```question
What is the difference between length, length() and size()?

---

`array.length` is a field of arrays; `string.length()` is a method on `String`; `collection.size()` is a method on collections.
```

```question
Can an array's size change?

---

No. To grow, allocate a bigger array and copy (`Arrays.copyOf`, `System.arraycopy`) — which is exactly what `ArrayList` does internally.
```

```question
Why can't you create a generic array like new T\[n\]?

---

Arrays check element types at runtime (they are <em>reified</em>), but generic types are erased. The JVM wouldn't know what `T` is, so `new T[]` and `new List<String>[]` are compile errors. Use `List<T>` or `(T[]) new Object[n]` with care.
```
