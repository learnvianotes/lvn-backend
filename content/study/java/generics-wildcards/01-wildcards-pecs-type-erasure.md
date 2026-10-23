---
id: 41064738-53b6-7f00-aac3-544f799675de
key: topic:java/generics-wildcards
subject: java
topic: generics-wildcards
title: Wildcards, PECS & Type Erasure
slug: wildcards-pecs-type-erasure
order: 1
---

`List<Integer>` is <strong>not</strong> a `List<Number>`. Wildcards (`?`, `? extends`, `? super`) restore flexibility, PECS tells you which to use, and type erasure explains generics' odd limitations.

# Generics are invariant

Even though `Integer` is a `Number`, `List<Integer>` is not a subtype of `List<Number>`. If it were, you could add a `Double` to a list of integers through the `List<Number>` reference.

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> ints = new ArrayList<>();
        List<Number> nums = ints;          // not allowed
        nums.add(3.14);
    }
}
```

```text filename:Compiler%20error
Main.java:6: error: incompatible types: List<Integer> cannot be converted to List<Number>
        List<Number> nums = ints;          // not allowed
                            ^
```

Arrays are <strong>covariant</strong> (`Integer[]` <em>is</em> an `Object[]`), so the same mistake compiles and only fails at runtime:

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Object[] objs = new Integer[2];      // compiles: arrays are covariant
        objs[0] = 1;
        try {
            objs[1] = "text";                // runtime type check
        } catch (ArrayStoreException e) {
            System.out.println("ArrayStoreException: " + e.getMessage());
        }
    }
}
```

```text filename:Output
ArrayStoreException: java.lang.String
```

# The three wildcards

| Wildcard | Accepts | Read as | Can add? |
| --- | --- | --- | --- |
| `List<?>` | A list of <em>any</em> type | `Object` | Only `null` |
| `List<? extends Number>` | `List<Number>`, `List<Integer>`, `List<Double>`… | `Number` | No (except `null`) |
| `List<? super Integer>` | `List<Integer>`, `List<Number>`, `List<Object>` | `Object` | <strong>Yes</strong>, `Integer`s |

```java filename:Java
import java.util.*;

public class Main {
    static double sum(List<? extends Number> nums) {    // producer: we only read
        double s = 0;
        for (Number n : nums) s += n.doubleValue();
        return s;
    }

    static void fill(List<? super Integer> sink, int n) { // consumer: we only write
        for (int i = 1; i <= n; i++) sink.add(i);
    }

    static int count(Collection<?> anything) { return anything.size(); }

    public static void main(String[] args) {
        System.out.println(sum(List.of(1, 2, 3)));         // List<Integer>
        System.out.println(sum(List.of(1.5, 2.5)));        // List<Double>

        List<Number> numbers = new ArrayList<>();
        List<Object> objects = new ArrayList<>();
        fill(numbers, 3);
        fill(objects, 2);
        System.out.println(numbers + " " + objects);
        System.out.println(count(Set.of("a", "b")));
    }
}
```

```text filename:Output
6.0
4.0
[1, 2, 3] [1, 2]
2
```

# PECS: Producer Extends, Consumer Super

`If a parameter `<strong>`produces`</strong>`  Ts for you → ? extends T. If it  `<strong>`consumes`</strong>` Ts → ? super T. Both → plain T.`

```java filename:Java
import java.util.*;

public class Main {
    // src produces T (extends), dest consumes T (super) — same shape as Collections.copy
    static <T> void copy(List<? super T> dest, List<? extends T> src) {
        for (T item : src) dest.add(item);
    }

    public static void main(String[] args) {
        List<Integer> ints = List.of(1, 2);
        List<Double> doubles = List.of(3.5);
        List<Number> all = new ArrayList<>();
        copy(all, ints);                      // T = Integer, Number is a super of it
        copy(all, doubles);                   // T = Double
        System.out.println(all);

        List<Object> objs = new ArrayList<>(List.of("x"));
        Main.<Integer>copy(objs, ints);
        System.out.println(objs);
    }
}
```

```text filename:Output
[1, 2, 3.5]
[x, 1, 2]
```

JDK examples: `Collections.copy(List<? super T> dest, List<? extends T> src)`, `addAll(Collection<? extends E>)`, `sort(Comparator<? super E>)` — a `Comparator<Object>` can sort a list of strings.

# Type erasure

> [!INFO]
>
> <strong>Type erasure</strong> — generics exist only at compile time. The compiler checks types, inserts casts, then replaces each type parameter with its bound (`Object` if unbounded). At runtime, `List<String>` and `List<Integer>` are the same class, `ArrayList`.

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> a = new ArrayList<>();
        List<Integer> b = new ArrayList<>();
        System.out.println(a.getClass() == b.getClass());
        System.out.println(a.getClass().getName());
        Object o = a;
        System.out.println(o instanceof List<?>);      // OK: unbounded wildcard
        // o instanceof List<String>                   // error: can't check a type argument at runtime
    }
}
```

```text filename:Output
true
java.util.ArrayList
true
```

| You can't… | Because at runtime `T` is erased | Workaround |
| --- | --- | --- |
| `new T()` | The JVM doesn't know what `T` is | Pass a `Supplier<T>` or `Class<T>` |
| `new T[n]`, `new List<String>[n]` | Arrays need their exact element type at runtime | Use a `List<T>`, or `(T[]) new Object[n]` with care |
| `x instanceof List<String>` | Type arguments aren't stored | `instanceof List<?>` |
| Overload `f(List<String>)` and `f(List<Integer>)` | Both erase to `f(List)` — same signature | Use different method names |
| `catch (T e)` / generic exception classes | Catch needs a runtime type | — |
| Use primitives as type arguments | Erasure turns `T` into `Object` | Boxed types, or specialised streams (`IntStream`) |

```java filename:Java
import java.util.*;
import java.util.function.Supplier;

public class Main {
    static <T> List<T> nCopies(int n, Supplier<T> factory) {    // instead of new T()
        List<T> out = new ArrayList<>();
        for (int i = 0; i < n; i++) out.add(factory.get());
        return out;
    }

    static <T> T create(Class<T> type) throws ReflectiveOperationException {
        return type.getDeclaredConstructor().newInstance();
    }

    public static void main(String[] args) throws Exception {
        System.out.println(nCopies(3, StringBuilder::new).size());
        System.out.println(create(ArrayList.class).isEmpty());
    }
}
```

```text filename:Output
3
true
```

# Bridge methods and heap pollution

When a class implements `Comparable<Money>`, its `compareTo(Money)` erases differently from the interface's `compareTo(Object)`. The compiler generates a synthetic <strong>bridge method</strong> `compareTo(Object)` that casts and delegates, so polymorphism still works after erasure.

```java filename:Java
import java.lang.reflect.Method;

public class Main {
    record Money(long cents) implements Comparable<Money> {
        public int compareTo(Money o) { return Long.compare(cents, o.cents); }
    }

    public static void main(String[] args) {
        java.util.List<String> found = new java.util.ArrayList<>();
        for (Method m : Money.class.getDeclaredMethods())
            if (m.getName().equals("compareTo"))
                found.add("compareTo(" + m.getParameterTypes()[0].getSimpleName() + ")"
                          + (m.isBridge() ? " <- bridge" : ""));
        java.util.Collections.sort(found);
        found.forEach(System.out::println);
    }
}
```

```text filename:Output
compareTo(Money)
compareTo(Object) <- bridge
```

<strong>Heap pollution</strong> happens when a variable of a parameterised type refers to an object that isn't of that type — typically through raw types, unchecked casts or generic varargs (`T...` creates a `T[]`). The compiler warns (`unchecked`); `@SafeVarargs` marks a varargs method that doesn't misuse its array.

> [!WARNING] Watch out
>
> An `unchecked` warning means the compiler can no longer guarantee type safety: a `ClassCastException` may appear later, far from the real bug, at a cast the compiler inserted. Don't suppress it unless you can prove the cast is safe.

```question
What is PECS?

---

<em>Producer Extends, Consumer Super</em>: use `? extends T` for a parameter you read `T`s from, `? super T` for one you write `T`s into. E.g. `copy(List<? super T> dest, List<? extends T> src)`.
```

```question
Why is List&lt;Integer&gt; not a subtype of List&lt;Number&gt;?

---

Generics are invariant for type safety: if it were, you could write `List<Number> n = ints; n.add(2.5);` and corrupt a list of integers. Use `List<? extends Number>` when you only need to read.
```

```question
What is type erasure and what are its consequences?

---

The compiler removes type arguments after checking them, replacing type variables with their bounds and inserting casts. So generic type info isn't available at runtime: no `new T()`, no generic arrays, no `instanceof List<String>`, and methods differing only by type argument clash.
```

```question
List&lt;?&gt; vs List&lt;Object&gt;?

---

`List<Object>` is a list you may add <em>any</em> object to, and only a `List<Object>` can be passed. `List<?>` accepts a list of <em>any</em> element type, but you can only read `Object`s from it and add nothing but `null`.
```
