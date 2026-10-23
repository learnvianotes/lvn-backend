---
id: b4beaf1d-0911-7112-a74e-022a30560663
key: topic:java/streams
subject: java
topic: streams
title: "Streams API: Intermediate & Terminal Operations"
slug: streams-api-intermediate-terminal-operations
order: 1
---

A stream is a lazy pipeline of operations over a sequence of elements — declare <em>what</em> to compute, and the library does the looping.

> [!INFO]
>
> <strong>Stream</strong> — a sequence of elements supporting aggregate operations. It <strong>stores nothing</strong>, <strong>doesn't modify its source</strong>, is <strong>lazy</strong> (nothing runs until a terminal operation) and is <strong>single-use</strong>.

Source (`list.stream()`) → Intermediate ops (`filter`, `map`…) — lazy → Terminal op (`collect`, `sum`…) — triggers work → Result

# A first pipeline

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> words = List.of("stream", "java", "lambda", "api", "collector", "map");

        List<String> result = words.stream()
                .filter(w -> w.length() > 3)      // keep long words
                .map(String::toUpperCase)         // transform
                .sorted()                         // natural order
                .toList();                        // terminal (Java 16+)
        System.out.println(result);

        // the imperative equivalent
        List<String> loop = new ArrayList<>();
        for (String w : words) if (w.length() > 3) loop.add(w.toUpperCase());
        Collections.sort(loop);
        System.out.println(loop.equals(result));
    }
}
```

```text filename:Output
[COLLECTOR, JAVA, LAMBDA, STREAM]
true
```

# Creating streams

| Source | Example |
| --- | --- |
| Collection | `list.stream()`, `set.parallelStream()` |
| Array | `Arrays.stream(arr)`, `Stream.of(1, 2, 3)` |
| Numeric range | `IntStream.range(0, 5)` (end exclusive), `rangeClosed(1, 5)` |
| Generated | `Stream.iterate(1, x -> x * 2)`, `Stream.generate(supplier)` — infinite, use `limit` |
| Bounded iterate (9+) | `Stream.iterate(1, x -> x < 100, x -> x * 2)` |
| Others | `str.chars()`, `Files.lines(path)`, `map.entrySet().stream()`, `Stream.empty()` |

# Intermediate operations (lazy, return a Stream)

| Operation | What it does | Stateful? |
| --- | --- | --- |
| `filter(pred)` | keep elements matching | No |
| `map(fn)` / `mapToInt(fn)` | transform each element (1 → 1) | No |
| `flatMap(fn)` | each element → a stream, flattened (1 → many) | No |
| `peek(action)` | look at elements as they pass (debugging) | No |
| `distinct()` | drop duplicates (uses `equals`/`hashCode`) | <strong>Yes</strong> |
| `sorted()` / `sorted(cmp)` | sort — must see <em>all</em> elements first | <strong>Yes</strong> |
| `limit(n)` / `skip(n)` | first n / drop first n (short-circuit `limit`) | Yes (count) |
| `takeWhile` / `dropWhile` (9+) | prefix while predicate holds | No |

```java filename:Java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<List<Integer>> nested = List.of(List.of(1, 2), List.of(3, 4), List.of(4, 5));
        System.out.println(nested.stream().flatMap(List::stream).toList());
        System.out.println(nested.stream().flatMap(List::stream).distinct().skip(1).limit(3).toList());

        System.out.println(Stream.of("b", "a", "c").sorted(Comparator.reverseOrder()).toList());
        System.out.println(Stream.iterate(1, x -> x * 2).limit(6).toList());
        System.out.println(IntStream.rangeClosed(1, 10).takeWhile(i -> i < 5).boxed().toList());
        System.out.println("hello".chars().filter(c -> c == 'l').count());
    }
}
```

```text filename:Output
[1, 2, 3, 4, 4, 5]
[2, 3, 4]
[c, b, a]
[1, 2, 4, 8, 16, 32]
[1, 2, 3, 4]
2
```

# Laziness: nothing runs until the terminal op

```java filename:Java
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Stream<Integer> pipeline = Stream.of(1, 2, 3, 4, 5, 6)
                .peek(x -> System.out.println("saw " + x))
                .filter(x -> x % 2 == 0)
                .map(x -> x * 10);
        System.out.println("pipeline built, nothing printed yet");

        Integer first = pipeline.findFirst().orElseThrow();   // terminal op
        System.out.println("first = " + first);
    }
}
```

```text filename:Output
pipeline built, nothing printed yet
saw 1
saw 2
first = 20
```

> [!NOTE] Vertical, short-circuiting
>
> Elements flow through the pipeline <strong>one at a time</strong> (vertical processing), not stage by stage. With a short-circuiting terminal op like `findFirst`, `anyMatch` or `limit`, the stream stops as soon as it has its answer — here it never looked at 3–6.

# Terminal operations

| Operation | Returns | Notes |
| --- | --- | --- |
| `forEach(action)` | void | order not guaranteed on parallel streams (`forEachOrdered`) |
| `collect(collector)` / `toList()` | a collection / value | see Collectors topic |
| `reduce(identity, op)` | `T` | fold into one value |
| `count()`, `min(cmp)`, `max(cmp)` | `long`, `Optional<T>` | min/max are Optional — stream may be empty |
| `sum()`, `average()`, `summaryStatistics()` | number / `OptionalDouble` | only on `IntStream`/`LongStream`/`DoubleStream` |
| `anyMatch`, `allMatch`, `noneMatch` | `boolean` | short-circuit; `allMatch` on empty = `true` |
| `findFirst()`, `findAny()` | `Optional<T>` | `findAny` is faster on parallel streams |
| `toArray()` | array | `toArray(String[]::new)` for a typed array |

```java filename:Java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = List.of(4, 8, 15, 16, 23, 42);

        System.out.println(nums.stream().reduce(0, Integer::sum));
        System.out.println(nums.stream().reduce(Integer::max).get());
        System.out.println(nums.stream().mapToInt(Integer::intValue).sum());
        System.out.println(nums.stream().mapToInt(i -> i).average().getAsDouble());
        System.out.println(nums.stream().max(Comparator.naturalOrder()).get());
        System.out.println(nums.stream().filter(n -> n > 100).count());
        System.out.println(nums.stream().anyMatch(n -> n % 2 == 1) + " " + nums.stream().allMatch(n -> n > 0));
        IntSummaryStatistics st = nums.stream().mapToInt(i -> i).summaryStatistics();
        System.out.println(st.getMin() + ".." + st.getMax() + " avg " + st.getAverage());
        String[] arr = Stream.of("x", "y").toArray(String[]::new);
        System.out.println(Arrays.toString(arr));
    }
}
```

```text filename:Output
108
42
108
18.0
42
0
true true
4..42 avg 18.0
[x, y]
```

# Primitive streams and boxing

`IntStream`, `LongStream` and `DoubleStream` avoid boxing and add `sum`, `average`, `range`. Convert with `mapToInt` / `mapToObj` / `boxed()`.

```java filename:Java
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        System.out.println(IntStream.range(0, 5).sum());
        System.out.println(IntStream.range(0, 5).boxed().toList());
        System.out.println(IntStream.rangeClosed(1, 5).mapToObj(i -> "#" + i).collect(Collectors.joining(",")));
        System.out.println(IntStream.of(3, 1, 2).map(i -> i * i).sorted().boxed().toList());
    }
}
```

```text filename:Output
10
[0, 1, 2, 3, 4]
#1,#2,#3,#4,#5
[1, 4, 9]
```

# Streams are single-use

```java filename:Java
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Stream<String> s = Stream.of("a", "b");
        System.out.println(s.count());
        try {
            s.count();                        // reuse → exception
        } catch (IllegalStateException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
2
stream has already been operated upon or closed
```

> [!TIP] Do
>
> Need the data twice? Keep the <em>collection</em> and call `.stream()` again, or hold a `Supplier<Stream<T>>`.

# Parallel streams — use with care

- `list.parallelStream()` or `.parallel()` splits the work across the common `ForkJoinPool` (cores − 1 threads).
- Worth it only for <strong>large</strong>, CPU-bound, easily splittable data (`ArrayList`, arrays, ranges) — not `LinkedList` or I/O.
- Lambdas must be <strong>stateless and non-interfering</strong>: never mutate a shared `ArrayList` from `forEach` — use `collect`.
- `reduce` needs an associative operation and a true identity (`0` for sum), or results change with the split.
- Order-dependent ops (`findFirst`, `limit`, `forEachOrdered`) cost extra in parallel; `findAny` / `unordered()` are cheaper.

> [!WARNING] Watch out
>
> Side effects in stream lambdas (`peek`, `map` that writes to an outer list) are a classic bug: behaviour can change with parallelism, and since Java 9 `count()` may even <em>skip</em> running `peek`/`map` when it can compute the size directly.

```question
Intermediate vs terminal operations?

---

Intermediate ops (`filter`, `map`, `sorted`) return a new `Stream` and are lazy — they only describe the pipeline. A terminal op (`collect`, `forEach`, `reduce`, `count`) consumes the stream, triggers all the work and produces a result or side effect. Without a terminal op, nothing executes.
```

```question
map vs flatMap?

---

`map` turns each element into exactly one element (`Stream<List<T>>` stays a stream of lists). `flatMap` turns each element into a <em>stream</em> and concatenates them — one-to-many, flattening `Stream<List<T>>` into `Stream<T>`.
```

```question
Stateless vs stateful intermediate operations?

---

Stateless ops (`filter`, `map`, `flatMap`) handle each element independently. Stateful ops (`sorted`, `distinct`, `limit`, `skip`) must remember elements seen so far — `sorted` buffers the entire stream before emitting anything, which hurts on huge or infinite streams and in parallel.
```

```question
Can a stream be reused? Does it modify its source?

---

No and no. A stream can be traversed once; a second terminal op throws `IllegalStateException`. It never changes the source collection — it produces new results. Modifying the source while the stream runs is interference and may throw `ConcurrentModificationException`.
```
