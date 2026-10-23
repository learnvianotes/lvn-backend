---
id: 1b03a13d-7b0a-736d-8397-9780f4a37672
key: topic:java/functional-interfaces
subject: java
topic: functional-interfaces
title: Functional Interfaces
slug: functional-interfaces
order: 1
---

An interface with exactly one abstract method — the <em>target type</em> that every lambda and method reference is converted to.

> [!INFO]
>
> <strong>Functional interface</strong> — an interface with a <strong>single abstract method</strong> (SAM). `default`, `static` and `private` methods don't count, nor do methods that `Object` already provides (`equals`, `toString`). A lambda is just a compact implementation of that one method.

# Declaring one

```java filename:Java
public class Main {
    @FunctionalInterface
    interface Calculator {
        int apply(int a, int b);                 // the single abstract method

        default Calculator twice() {             // defaults are allowed
            return (a, b) -> apply(apply(a, b), b);
        }
    }

    public static void main(String[] args) {
        Calculator add = (a, b) -> a + b;
        Calculator mul = (a, b) -> a * b;
        System.out.println(add.apply(3, 4));
        System.out.println(mul.apply(3, 4));
        System.out.println(add.twice().apply(3, 4));   // (3 + 4) + 4
    }
}
```

```text filename:Output
7
12
11
```

> [!NOTE] Annotation
>
> `@FunctionalInterface` is optional but recommended: the compiler then <em>rejects</em> the interface if someone adds a second abstract method, protecting every lambda that depends on it.

```java filename:Java
@FunctionalInterface
interface Broken {
    void first();
    void second();      // error: Broken is not a functional interface
}
```

# The `java.util.function` toolbox

You rarely need to declare your own — the JDK ships 43 standard shapes. Learn the six core ones; the rest are variations.

| Interface | Method | Shape | Typical use |
| --- | --- | --- | --- |
| `Predicate<T>` | `boolean test(T t)` | T → boolean | `filter`, `removeIf` |
| `Function<T, R>` | `R apply(T t)` | T → R | `map`, `computeIfAbsent` |
| `Consumer<T>` | `void accept(T t)` | T → nothing | `forEach` |
| `Supplier<T>` | `T get()` | nothing → T | lazy defaults, `orElseGet`, factories |
| `UnaryOperator<T>` | `T apply(T t)` | T → T | `replaceAll`, `Stream.iterate` |
| `BinaryOperator<T>` | `T apply(T a, T b)` | (T, T) → T | `reduce`, `merge` |
| `BiFunction<T, U, R>` | `R apply(T t, U u)` | (T, U) → R | `Map.compute`, `replaceAll` on maps |
| `BiConsumer<T, U>` / `BiPredicate<T, U>` | `accept` / `test` | two inputs | `Map.forEach` |

<strong>Primitive specializations</strong> avoid boxing: `IntPredicate`, `IntFunction<R>`, `ToIntFunction<T>`, `IntUnaryOperator`, `IntBinaryOperator`, `IntSupplier`, `IntConsumer` (plus `Long*` / `Double*` versions, and `ObjIntConsumer<T>`).

```java filename:Java
import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        Predicate<String> isEmpty = String::isEmpty;
        Function<String, Integer> length = String::length;
        Consumer<String> shout = s -> System.out.println(s.toUpperCase());
        Supplier<String> greeting = () -> "hello";
        UnaryOperator<Integer> square = x -> x * x;
        BinaryOperator<Integer> max = Math::max;
        IntBinaryOperator add = (a, b) -> a + b;      // no boxing

        System.out.println(isEmpty.test(""));
        System.out.println(length.apply("lambda"));
        shout.accept("java");
        System.out.println(greeting.get());
        System.out.println(square.apply(7) + " " + max.apply(3, 9) + " " + add.applyAsInt(2, 3));
    }
}
```

```text filename:Output
true
6
JAVA
hello
49 9 5
```

# Composition

The standard interfaces have `default` methods that build new functions out of old ones — no new classes needed.

| Method | On | Meaning |
| --- | --- | --- |
| `f.andThen(g)` | `Function`, `Consumer` | run `f`, then `g` on the result: `g(f(x))` |
| `f.compose(g)` | `Function` | run `g` first: `f(g(x))` |
| `p.and(q)` / `p.or(q)` / `p.negate()` | `Predicate` | logical combination (short-circuits) |
| `Predicate.not(p)` | `Predicate` (static, 11+) | negate a method ref: `filter(not(String::isBlank))` |
| `Function.identity()` | `Function` (static) | `x -> x` |

```java filename:Java
import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        Function<Integer, Integer> plus2 = x -> x + 2;
        Function<Integer, Integer> times3 = x -> x * 3;
        System.out.println(plus2.andThen(times3).apply(1));   // (1 + 2) * 3
        System.out.println(plus2.compose(times3).apply(1));   // (1 * 3) + 2

        Predicate<String> longWord = s -> s.length() > 4;
        Predicate<String> startsJ = s -> s.startsWith("J");
        System.out.println(longWord.and(startsJ).test("Java"));
        System.out.println(longWord.or(startsJ).test("Java"));
        System.out.println(longWord.negate().test("Java"));
    }
}
```

```text filename:Output
9
5
false
true
true
```

> [!WARNING] Watch out
>
> A lambda has no type of its own — `var f = x -> x;` does not compile. The compiler needs a target functional interface from the assignment, parameter or cast.

```question
What makes an interface functional?

---

Exactly one abstract method. `default`/`static`/`private` methods and abstract methods that match public `Object` methods (like `boolean equals(Object)` in `Comparator`) don't count. `Comparator`, `Runnable`, `Callable` and everything in `java.util.function` are functional interfaces.
```

```question
Why do primitive specializations like IntPredicate exist?

---

Generics only work with reference types, so `Predicate<Integer>` boxes every `int` into an `Integer`. `IntPredicate.test(int)` takes the primitive directly — no allocation, no unboxing — which matters in hot loops and streams (`IntStream`).
```

```question
Function vs UnaryOperator vs BinaryOperator?

---

`UnaryOperator<T>` extends `Function<T, T>` (same input and output type); `BinaryOperator<T>` extends `BiFunction<T, T, T>`. Use the narrower one when types match — it documents intent and fits APIs like `List.replaceAll(UnaryOperator)` and `Stream.reduce(BinaryOperator)`.
```
