---
id: 95bb262c-e117-7ab8-949f-4673014dc16d
key: topic:java/wrappers-autoboxing
subject: java
topic: wrappers-autoboxing
title: Wrapper Classes, Autoboxing & the Integer Cache
slug: wrapper-classes-autoboxing-the-integer-cache
order: 1
---

Each primitive has an immutable wrapper class so it can live where objects are required (collections, generics, `null`). The compiler converts between them automatically — sometimes with surprising results.

| Primitive | Wrapper | Cache (`valueOf`) |
| --- | --- | --- |
| `byte` | `Byte` | all values |
| `short` | `Short` | −128 … 127 |
| `int` | `Integer` | −128 … 127 (upper bound tunable) |
| `long` | `Long` | −128 … 127 |
| `char` | `Character` | 0 … 127 |
| `boolean` | `Boolean` | `TRUE` / `FALSE` |
| `float` / `double` | `Float` / `Double` | none |

> [!INFO]
>
> <strong>Autoboxing / unboxing</strong> — the compiler's automatic conversion `int` → `Integer` (it inserts `Integer.valueOf(x)`) and `Integer` → `int` (it inserts `x.intValue()`).

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>();
        list.add(5);                  // autoboxing: Integer.valueOf(5)
        int first = list.get(0);      // unboxing: list.get(0).intValue()
        Integer total = 0;
        for (int i = 1; i <= 3; i++) total += i;   // unbox, add, box again each time
        System.out.println(first + " " + total);
        System.out.println(Integer.parseInt("123") + 1);       // String → int
        System.out.println(Integer.valueOf("123").getClass().getSimpleName());
        System.out.println(Integer.toBinaryString(10) + " " + Integer.toHexString(255));
        System.out.println(Character.isDigit('7') + " " + Character.toUpperCase('q'));
    }
}
```

```text filename:Output
5 6
124
Integer
1010 ff
true Q
```

# The Integer cache trap

`Integer.valueOf` returns <em>cached</em> objects for −128…127. `==` on wrappers compares <strong>references</strong>, so it “works” for small numbers and breaks for bigger ones.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        Integer c = 128, d = 128;
        System.out.println(a == b);          // same cached object
        System.out.println(c == d);          // two different objects
        System.out.println(c.equals(d));     // compare values
        System.out.println(c.intValue() == d);  // one side primitive → unboxes → value compare
    }
}
```

```text filename:Output
true
false
true
true
```

> [!WARNING] Watch out
>
> Never compare wrapper objects with `==`. Use `equals`, or unbox first. (`new Integer(5)` is deprecated for removal precisely because it bypasses the cache.)

# NullPointerException from unboxing

```java filename:Java
import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> stock = new HashMap<>();
        stock.put("apple", 3);
        try {
            int bananas = stock.get("banana");   // get → null → null.intValue()
            System.out.println(bananas);
        } catch (NullPointerException e) {
            System.out.println("NPE while unboxing");
        }
        int safe = stock.getOrDefault("banana", 0);
        System.out.println(safe);
    }
}
```

```text filename:Output
NPE while unboxing
0
```

# Performance cost

- Each boxed value is a separate heap object (\~16 bytes vs 4 for an `int`), plus the reference.
- Summing into a `Long` inside a loop creates millions of garbage objects — use a primitive `long`.
- Prefer `int[]` over `List<Integer>` and `IntStream` over `Stream<Integer>` for heavy numeric work.

```question
What does Integer a = 1000, b = 1000; a == b print, and why?

---

`false` (by default). Autoboxing calls `Integer.valueOf`, which only caches −128…127, so 1000 creates two distinct objects and `==` compares references. With `127` it prints `true`.
```

```question
Why do we need wrapper classes?

---

Generics and collections work only with objects (`List<int>` is illegal), wrappers can be `null` ("no value"), and they carry utility methods (`parseInt`, `MAX_VALUE`, `compare`, `toBinaryString`).
```

```question
Can the Integer cache range be changed?

---

The upper bound can be raised with the JVM flag `-XX:AutoBoxCacheMax=<n>` (or `java.lang.Integer.IntegerCache.high`). The lower bound is fixed at −128.
```
