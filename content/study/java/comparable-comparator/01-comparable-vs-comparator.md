---
id: 978dc31f-734c-7325-98fe-24d30809baa0
key: topic:java/comparable-comparator
subject: java
topic: comparable-comparator
title: Comparable vs Comparator
slug: comparable-vs-comparator
order: 1
---

`Comparable` gives a class its one <em>natural</em> order (`compareTo`); a `Comparator` is any number of external orders built fluently with `comparing`, `thenComparing` and `reversed`.

|  | `Comparable<T>` | `Comparator<T>` |
| --- | --- | --- |
| Package | `java.lang` | `java.util` |
| Method | `int compareTo(T other)` | `int compare(T a, T b)` |
| Where | Inside the class being sorted | Separate object / lambda |
| How many orders | One — the natural order | As many as you like |
| Used by | `Collections.sort(list)`, `TreeMap`, `Arrays.sort` with no comparator | `list.sort(cmp)`, `new TreeSet<>(cmp)`, `stream.sorted(cmp)` |
| Examples in the JDK | `String`, `Integer`, `LocalDate`, enums | `String.CASE_INSENSITIVE_ORDER`, `Comparator.reverseOrder()` |

# The contract

- Return <strong>negative</strong> if `this < other`, <strong>zero</strong> if equal, <strong>positive</strong> if greater — only the sign matters.
- Antisymmetric: `sgn(a.compareTo(b)) == -sgn(b.compareTo(a))`; transitive; consistent across calls.
- <em>Strongly recommended</em>: consistent with `equals` (`compareTo == 0` ⇔ `equals`) — sorted sets and maps use `compareTo` for equality.

# Natural order with `Comparable`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Version> vs = new ArrayList<>(List.of(new Version(1, 10), new Version(1, 2), new Version(0, 9)));
        Collections.sort(vs);
        System.out.println(vs);
        System.out.println(Collections.max(vs));
    }
}

record Version(int major, int minor) implements Comparable<Version> {
    @Override
    public int compareTo(Version o) {
        int c = Integer.compare(major, o.major);
        return c != 0 ? c : Integer.compare(minor, o.minor);
    }

    @Override
    public String toString() { return major + "." + minor; }
}
```

```text filename:Output
[0.9, 1.2, 1.10]
1.10
```

# Building comparators fluently

```java filename:Java
import java.util.*;

public class Main {
    record Emp(String name, String dept, int salary) {}

    public static void main(String[] args) {
        List<Emp> staff = new ArrayList<>(List.of(
            new Emp("Ravi", "HR", 50), new Emp("Asha", "Eng", 90),
            new Emp("Meera", "Eng", 70), new Emp("Kiran", "HR", 50)));

        staff.sort(Comparator.comparing(Emp::dept)
                .thenComparing(Emp::salary, Comparator.reverseOrder())
                .thenComparing(Emp::name));
        staff.forEach(e -> System.out.println(e.dept() + " " + e.salary() + " " + e.name()));

        List<String> words = new ArrayList<>(List.of("pear", "Fig", "apple", "kiwi"));
        words.sort(Comparator.comparingInt(String::length).reversed());
        System.out.println(words);
        words.sort(String.CASE_INSENSITIVE_ORDER);
        System.out.println(words);

        List<String> withNull = new ArrayList<>(Arrays.asList("b", null, "a"));
        withNull.sort(Comparator.nullsFirst(Comparator.naturalOrder()));
        System.out.println(withNull);
    }
}
```

```text filename:Output
Eng 90 Asha
Eng 70 Meera
HR 50 Kiran
HR 50 Ravi
[apple, pear, kiwi, Fig]
[apple, Fig, kiwi, pear]
[null, a, b]
```

| Factory / method | Meaning |
| --- | --- |
| `Comparator.comparing(keyFn)` | Compare by an extracted `Comparable` key |
| `comparingInt/Long/Double(fn)` | Same, without boxing |
| `.thenComparing(...)` | Tie-breaker |
| `.reversed()` | Flip the whole chain built <em>so far</em> |
| `Comparator.naturalOrder()` / `reverseOrder()` | Natural order / its reverse |
| `nullsFirst(cmp)` / `nullsLast(cmp)` | Treat `null` as smallest / largest |

> [!NOTE] Key point
>
> Sorting is <strong>stable</strong> for objects (`List.sort`, `Collections.sort`, `Arrays.sort(Object[])` use TimSort): equal elements keep their relative order — which is why multi-key sorts can also be done as successive sorts.

# Trap: comparing by subtraction

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Comparator<Integer> bad = (a, b) -> a - b;          // overflows for far-apart values
        Comparator<Integer> good = Integer::compare;
        int big = Integer.MAX_VALUE, small = -1;
        System.out.println("a - b says: " + bad.compare(big, small));
        System.out.println("compare says: " + good.compare(big, small));

        List<Integer> xs = new ArrayList<>(List.of(Integer.MIN_VALUE, 1));
        xs.sort(bad);                                       // 1 - MIN_VALUE overflows to negative
        System.out.println(xs);
    }
}
```

```text filename:Output
a - b says: -2147483648
compare says: 1
[1, -2147483648]
```

> [!WARNING] Watch out
>
> `a - b` overflows when the operands have opposite signs and large magnitudes, flipping the sign and breaking the sort. Always use `Integer.compare(a, b)` or `Comparator.comparingInt`.

```question
Comparable vs Comparator — when to use which?

---

Implement `Comparable` when the class has one obvious natural order (numbers, dates, versions). Use a `Comparator` for alternative orders, for classes you can't modify, or for multi-field sorts built with `comparing(...).thenComparing(...)`.
```

```question
What happens if compareTo is inconsistent with equals?

---

Sorted collections use `compareTo` for equality, so a `TreeSet` may drop elements that `equals` considers different (or keep ones it considers equal). Classic JDK example: `new BigDecimal("1.0")` and `new BigDecimal("1.00")` are not `equals` (HashSet keeps 2) but compare as 0 (TreeSet keeps 1).
```

```question
How does reversed() behave in a chain?

---

It reverses everything built before it. `comparing(A).thenComparing(B).reversed()` reverses both keys; to reverse only B write `thenComparing(B, Comparator.reverseOrder())` or `thenComparing(comparing(B).reversed())`.
```
