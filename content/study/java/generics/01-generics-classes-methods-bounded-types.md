---
id: ee81841f-282f-7f4c-b5bf-a6d0f8beed8f
key: topic:java/generics
subject: java
topic: generics
title: "Generics: Classes, Methods & Bounded Types"
slug: generics-classes-methods-bounded-types
order: 1
---

Generics let a class or method work with <em>any</em> type while the compiler still checks types — no casts, and type errors show up at compile time instead of as `ClassCastException` at runtime.

> [!INFO]
>
> <strong>Type parameter</strong> — a placeholder type such as `T` in `class Box<T>`. Using the class with a concrete type argument, `Box<String>`, makes every `T` mean `String` for the compiler.

# Why generics?

```java filename:Java
import java.util.*;

public class Main {
    @SuppressWarnings({"rawtypes", "unchecked"})
    public static void main(String[] args) {
        List raw = new ArrayList();            // pre-Java-5 style: a list of Object
        raw.add("hello");
        raw.add(42);                           // compiler can't stop this
        try {
            for (Object o : raw) {
                String s = (String) o;         // manual cast, fails at runtime
                System.out.println(s.toUpperCase());
            }
        } catch (ClassCastException e) {
            System.out.println("ClassCastException at runtime");
        }

        List<String> typed = new ArrayList<>();
        typed.add("hello");
        // typed.add(42);                      // compile error instead
        String s = typed.get(0);               // no cast needed
        System.out.println(s.length());
    }
}
```

```text filename:Output
HELLO
ClassCastException at runtime
5
```

# Generic classes

```java filename:Java
public class Main {
    static class Box<T> {
        private T value;
        Box(T value) { this.value = value; }
        T get() { return value; }
        <R> Box<R> map(java.util.function.Function<T, R> f) { return new Box<>(f.apply(value)); }
    }

    record Pair<A, B>(A first, B second) {
        Pair<B, A> swap() { return new Pair<>(second, first); }
    }

    public static void main(String[] args) {
        Box<String> name = new Box<>("generics");      // diamond: type inferred
        Box<Integer> len = name.map(String::length);
        System.out.println(name.get() + " " + len.get());

        Pair<String, Integer> p = new Pair<>("age", 30);
        System.out.println(p.swap());
        var q = new Pair<>(1.5, true);                  // Pair<Double, Boolean>
        System.out.println(q.first() + " " + q.second());
    }
}
```

```text filename:Output
generics 8
Pair[first=30, second=age]
1.5 true
```

| Convention | Stands for |
| --- | --- |
| `T`, `U`, `V` | Type (first, second, third) |
| `E` | Element (collections) |
| `K`, `V` | Key, Value (maps) |
| `R` | Return / result type |
| `N` | Number |

# Generic methods

```java filename:Java
import java.util.*;

public class Main {
    static <T> T firstOr(List<T> list, T fallback) {       // <T> before the return type
        return list.isEmpty() ? fallback : list.get(0);
    }

    static <K, V> Map<V, K> invert(Map<K, V> map) {
        Map<V, K> out = new TreeMap<>();
        map.forEach((k, v) -> out.put(v, k));
        return out;
    }

    public static void main(String[] args) {
        System.out.println(firstOr(List.of("a", "b"), "none"));
        System.out.println(firstOr(List.<Integer>of(), -1));     // explicit type witness
        System.out.println(invert(Map.of("one", 1, "two", 2)));
    }
}
```

```text filename:Output
a
-1
{1=one, 2=two}
```

# Bounded type parameters

`<T extends Bound>` restricts `T` to `Bound` or its subtypes — and in return lets you call `Bound`'s methods on a `T`. (`extends` is used for both classes and interfaces; multiple bounds: `<T extends Number & Comparable<T>>`, class first.)

```java filename:Java
import java.util.*;

public class Main {
    static <T extends Comparable<T>> T max(List<T> items) {
        T best = items.get(0);
        for (T item : items)
            if (item.compareTo(best) > 0) best = item;   // compareTo allowed thanks to the bound
        return best;
    }

    static <N extends Number> double sum(List<N> nums) {
        double total = 0;
        for (N n : nums) total += n.doubleValue();       // Number's method
        return total;
    }

    public static void main(String[] args) {
        System.out.println(max(List.of(3, 9, 4)));
        System.out.println(max(List.of("pear", "apple", "zucchini")));
        System.out.println(sum(List.of(1, 2.5, 3L)));
    }
}
```

```text filename:Output
9
zucchini
6.5
```

# Primitives and restrictions

- Type arguments must be reference types: `List<int>` is illegal — use `List<Integer>` (autoboxing does the conversion).
- A static field or static method can't use the class's `T` (there's one static copy for all `Box<X>`), though a static method can declare its own `<T>`.
- You can't create `new T()`, `new T[n]`, or `new List<String>[n]` — see type erasure in the next topic.

> [!WARNING] Raw types
>
> <strong>Raw types</strong> (`List` instead of `List<String>`) exist only for pre-Java-5 compatibility. They switch off generic type checking for that variable and produce `rawtypes`/`unchecked` warnings. Never use them in new code; use `List<?>` if you really mean "a list of unknown type".

```question
What are generics and why use them?

---

Parameterised types that let one class/method work with many types while keeping compile-time type safety. Benefits: errors caught at compile time, no explicit casts, and reusable, self-documenting APIs (`Map<String, List<Order>>`).
```

```question
What does &lt;T extends Comparable&lt;T&gt;&gt; mean?

---

`T` can be any type that is comparable to itself, so the method may call `a.compareTo(b)` on two `T`s. The fully flexible version used by the JDK is `<T extends Comparable<? super T>>`, which also accepts types whose `compareTo` is inherited from a supertype.
```

```question
What is the diamond operator?

---

`<>` in `new ArrayList<>()` (Java 7+): the compiler infers the type arguments from the context, so you don't repeat `ArrayList<String>`.
```
