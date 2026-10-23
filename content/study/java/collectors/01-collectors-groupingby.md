---
id: 438e77e3-cafa-7ff9-9526-8138b9dc87ef
key: topic:java/collectors
subject: java
topic: collectors
title: Collectors & groupingBy
slug: collectors-groupingby
order: 1
---

`collect(...)` is the terminal operation that turns a stream into a collection, map, string or summary — and `Collectors` is the toolbox of recipes for it.

> [!INFO]
>
> <strong>Collector</strong> — a recipe of four functions — <em>supplier</em> (new container), <em>accumulator</em> (add an element), <em>combiner</em> (merge two containers, for parallel runs) and <em>finisher</em> — that `Stream.collect` uses to perform a mutable reduction.

# Into lists and sets

| Call | Result | Mutable? | Nulls? |
| --- | --- | --- | --- |
| `stream.toList()` (16+) | `List<T>` | <strong>No</strong> — unmodifiable | allowed |
| `collect(Collectors.toList())` | `List<T>` (an `ArrayList` in practice) | yes (not guaranteed) | allowed |
| `collect(Collectors.toUnmodifiableList())` (10+) | `List<T>` | No | <strong>NPE</strong> |
| `collect(Collectors.toSet())` | `Set<T>` (a `HashSet`) | yes | allowed |
| `collect(Collectors.toCollection(TreeSet::new))` | the exact type you choose | yes | depends |

```java filename:Java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<String> fixed = Stream.of("b", "a").toList();
        List<String> growable = Stream.of("b", "a").collect(Collectors.toList());
        growable.add("c");
        System.out.println(growable);
        try {
            fixed.add("c");
        } catch (UnsupportedOperationException e) {
            System.out.println("toList() result is unmodifiable");
        }
        TreeSet<String> sorted = Stream.of("pear", "apple", "fig", "apple")
                .collect(Collectors.toCollection(TreeSet::new));
        System.out.println(sorted);
    }
}
```

```text filename:Output
[b, a, c]
toList() result is unmodifiable
[apple, fig, pear]
```

# Into maps: `toMap`

```java filename:Java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<String> words = List.of("apple", "avocado", "banana", "cherry");

        Map<String, Integer> lengths = words.stream()
                .collect(Collectors.toMap(w -> w, String::length, (a, b) -> a, TreeMap::new));
        System.out.println(lengths);

        try {
            words.stream().collect(Collectors.toMap(w -> w.charAt(0), w -> w));   // 'a' twice
        } catch (IllegalStateException e) {
            System.out.println(e.getMessage());
        }

        // merge function decides what to do with duplicate keys
        Map<Character, String> byLetter = words.stream()
                .collect(Collectors.toMap(w -> w.charAt(0), w -> w, (a, b) -> a + "|" + b, TreeMap::new));
        System.out.println(byLetter);
    }
}
```

```text filename:Output
{apple=5, avocado=7, banana=6, cherry=6}
Duplicate key a (attempted merging values apple and avocado)
{a=apple|avocado, b=banana, c=cherry}
```

> [!WARNING] Watch out
>
> `toMap(keyFn, valueFn)` throws `IllegalStateException: Duplicate key` on the first collision, and `NullPointerException` if a <em>value</em> is `null`. Pass a merge function whenever keys might repeat.

# `groupingBy` — the SQL `GROUP BY` of Java

`groupingBy(classifier)` builds a `Map<K, List<T>>`. The two optional arguments are the <strong>map factory</strong> and a <strong>downstream collector</strong> applied to each group.

```java filename:Java
import java.util.*;
import java.util.stream.*;

public class Main {
    record Emp(String name, String dept, int salary) {}

    public static void main(String[] args) {
        List<Emp> emps = List.of(
                new Emp("Asha", "Eng", 120), new Emp("Ravi", "HR", 70),
                new Emp("Zoe", "Eng", 100), new Emp("Mohan", "Sales", 80),
                new Emp("Lena", "HR", 75));

        Map<String, List<String>> names = emps.stream().collect(Collectors.groupingBy(
                Emp::dept, TreeMap::new, Collectors.mapping(Emp::name, Collectors.toList())));
        System.out.println(names);

        Map<String, Long> counts = emps.stream().collect(
                Collectors.groupingBy(Emp::dept, TreeMap::new, Collectors.counting()));
        System.out.println(counts);

        Map<String, Integer> payroll = emps.stream().collect(
                Collectors.groupingBy(Emp::dept, TreeMap::new, Collectors.summingInt(Emp::salary)));
        System.out.println(payroll);

        Map<String, Double> avg = emps.stream().collect(
                Collectors.groupingBy(Emp::dept, TreeMap::new, Collectors.averagingInt(Emp::salary)));
        System.out.println(avg);

        Map<String, Optional<Emp>> top = emps.stream().collect(Collectors.groupingBy(
                Emp::dept, TreeMap::new, Collectors.maxBy(Comparator.comparingInt(Emp::salary))));
        top.forEach((d, e) -> System.out.println(d + " -> " + e.get().name()));
    }
}
```

```text filename:Output
{Eng=[Asha, Zoe], HR=[Ravi, Lena], Sales=[Mohan]}
{Eng=2, HR=2, Sales=1}
{Eng=220, HR=145, Sales=80}
{Eng=110.0, HR=72.5, Sales=80.0}
Eng -> Asha
HR -> Lena
Sales -> Mohan
```

> [!NOTE] Deterministic order
>
> Plain `groupingBy(f)` returns a `HashMap`, so the key order you print is not something to rely on. Pass `TreeMap::new` (sorted) or `LinkedHashMap::new` (encounter order) when order matters.

| Downstream collector | Per group you get |
| --- | --- |
| `counting()` | `Long` count |
| `summingInt(f)` / `averagingDouble(f)` | sum / average |
| `mapping(f, toList())` | a list of a projected field |
| `maxBy(cmp)` / `minBy(cmp)` | `Optional<T>` |
| `toSet()`, `joining(", ")` | set / concatenated string |
| `collectingAndThen(c, fn)` | post-process, e.g. unwrap the `Optional` |
| `groupingBy(...)` | nested (multi-level) grouping |

# `partitioningBy`, `joining` and friends

```java filename:Java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = List.of(1, 2, 3, 4, 5, 6, 7);

        Map<Boolean, List<Integer>> evenOdd = nums.stream()
                .collect(Collectors.partitioningBy(n -> n % 2 == 0));
        System.out.println(evenOdd);

        System.out.println(Stream.of("a", "b", "c").collect(Collectors.joining(", ", "[", "]")));

        IntSummaryStatistics st = nums.stream().collect(Collectors.summarizingInt(n -> n));
        System.out.println(st);

        Map<Integer, Long> byLength = Stream.of("hi", "yo", "hey", "java", "sun")
                .collect(Collectors.groupingBy(String::length, TreeMap::new, Collectors.counting()));
        System.out.println(byLength);
    }
}
```

```text filename:Output
{false=[1, 3, 5, 7], true=[2, 4, 6]}
[a, b, c]
IntSummaryStatistics{count=7, sum=28, min=1, average=4.000000, max=7}
{2=2, 3=2, 4=1}
```

`partitioningBy` always has exactly two keys, `false` and `true` — even if one group is empty — which makes it nicer than `groupingBy` with a boolean.

```question
Stream.toList() vs Collectors.toList()?

---

`Stream.toList()` (Java 16) returns an <strong>unmodifiable</strong> list and accepts `null` elements. `Collectors.toList()` returns a list with no guarantees on type or mutability (an `ArrayList` in practice, so callers often mutate it). Prefer `toList()` for results you only read; use `toCollection(ArrayList::new)` when you need to mutate.
```

```question
How would you count word frequencies with streams?

---

`words.stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))` → `Map<String, Long>`. Add `TreeMap::new` as the middle argument for sorted keys.
```

```question
What happens with duplicate keys in Collectors.toMap?

---

Without a merge function it throws `IllegalStateException` ("Duplicate key …"). Supply the third argument, e.g. `(a, b) -> a` to keep the first or `Integer::sum` to add counts; a fourth argument chooses the map implementation.
```
