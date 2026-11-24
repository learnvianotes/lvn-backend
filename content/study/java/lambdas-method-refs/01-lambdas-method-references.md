---
id: e99509ed-429e-737c-b88d-c0536bf2334f
key: topic:java/lambdas-method-refs
subject: java
topic: lambdas-method-refs
title: Lambdas & Method References
slug: lambdas-method-references
order: 1
---

A lambda is an anonymous function you can pass around as a value; a method reference is a lambda that just calls an existing method.

> [!INFO]
>
> <strong>Lambda expression</strong> — `(parameters) -> body` — an instance of a functional interface, written inline. Introduced in Java 8, it replaced most anonymous inner classes.

# Syntax forms

| Form | Example |
| --- | --- |
| No parameters | `() -> 42` |
| One parameter (parentheses optional) | `s -> s.length()` |
| Several parameters | `(a, b) -> a + b` |
| Explicit types | `(String a, String b) -> a.compareTo(b)` |
| `var` parameters (11+, allows annotations) | `(var a, var b) -> a + b` |
| Block body (needs `return`) | `x -> { int y = x * 2; return y + 1; }` |

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>(List.of("Ravi", "Asha", "Zoe", "Mohan"));

        // Before Java 8: an anonymous class
        names.sort(new Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                return a.compareTo(b);
            }
        });
        System.out.println(names);

        // Java 8+: a lambda
        names.sort((a, b) -> b.length() - a.length());
        System.out.println(names);

        names.removeIf(s -> s.length() < 4);
        names.forEach(s -> System.out.print(s + " "));
        System.out.println();
    }
}
```

```text filename:Output
[Asha, Mohan, Ravi, Zoe]
[Mohan, Asha, Ravi, Zoe]
Mohan Asha Ravi
```

# Capturing variables: effectively final

A lambda can read local variables from the enclosing method only if they are <strong>effectively final</strong> — never reassigned after initialisation. The lambda captures the <em>value</em>, and Java forbids the variable changing underneath it.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int count = 0;
        Runnable r = () -> count++;     // error: must be final or effectively final
        r.run();
    }
}
```

```java filename:Java
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) {
        String prefix = "item-";                  // effectively final: OK to capture
        AtomicInteger counter = new AtomicInteger();  // the reference is final; its state can change
        List.of("a", "b", "c").forEach(s -> {
            counter.incrementAndGet();
            System.out.println(prefix + s);
        });
        System.out.println("count = " + counter.get());
    }
}
```

```text filename:Output
item-a
item-b
item-c
count = 3
```

> [!NOTE] Fields are different
>
> Fields (instance or `static`) are <em>not</em> restricted — a lambda reads them through `this` or the class. Only captured <strong>local</strong> variables must be effectively final.

# `this` in a lambda vs an anonymous class

```java filename:Java
public class Main {
    String name = "outer";

    void demo() {
        Runnable lambda = () -> System.out.println("lambda this: " + this.name);
        Runnable anon = new Runnable() {
            String name = "anonymous";
            @Override
            public void run() {
                System.out.println("anon this:   " + this.name);
            }
        };
        lambda.run();
        anon.run();
    }

    public static void main(String[] args) {
        new Main().demo();
    }
}
```

```text filename:Output
lambda this: outer
anon this:   anonymous
```

|  | Lambda | Anonymous class |
| --- | --- | --- |
| `this` refers to | the <strong>enclosing</strong> instance | the anonymous object itself |
| New scope? | No — can't redeclare an enclosing local name | Yes — can shadow names |
| Implements | only functional interfaces | any interface or class, many methods, can hold state |
| Compiled to | `invokedynamic` + a private method (no extra `.class` file) | a separate `Outer$1.class` |

# Method references — four kinds

When a lambda only forwards its arguments to one method, write `Class::method` instead.

| Kind | Syntax | Equivalent lambda |
| --- | --- | --- |
| Static method | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| Instance method of a <strong>particular</strong> object | `System.out::println` | `x -> System.out.println(x)` |
| Instance method of an <strong>arbitrary</strong> object of a type | `String::toUpperCase` | `s -> s.toUpperCase()` |
| Constructor | `ArrayList::new` | `() -> new ArrayList<>()` |

```java filename:Java
import java.util.*;
import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        Function<String, Integer> parse = Integer::parseInt;         // static
        String greeting = "Hello";
        Predicate<String> startsWithIt = greeting::startsWith;       // particular object
        Function<String, String> upper = String::toUpperCase;        // arbitrary object
        BiFunction<String, String, Boolean> eq = String::equalsIgnoreCase; // first arg is the receiver
        Supplier<List<String>> newList = ArrayList::new;             // constructor
        Function<Integer, int[]> newArray = int[]::new;              // array constructor

        System.out.println(parse.apply("41") + 1);
        System.out.println(startsWithIt.test("Hell"));
        System.out.println(upper.apply("java"));
        System.out.println(eq.apply("JAVA", "java"));
        List<String> list = newList.get();
        list.add("x");
        System.out.println(list + " " + newArray.apply(3).length);
    }
}
```

```text filename:Output
42
true
JAVA
true
[x] 3
```

> [!WARNING] Watch out
>
> `System.out::println` evaluates `System.out` <em>once</em>, when the reference is created — the lambda `x -> System.out.println(x)` looks it up on every call. Usually irrelevant, but a `null` receiver in `obj::method` throws `NullPointerException` immediately, not when called.

```question
Are lambdas just syntactic sugar for anonymous classes?

---

No. They compile to an `invokedynamic` call site plus a private synthetic method; the JVM creates the implementation at run time (via `LambdaMetafactory`). No `.class` file per lambda, non-capturing lambdas are cached as singletons, and `this` means the enclosing instance rather than a new object.
```

```question
Why must captured local variables be effectively final?

---

Locals live on the stack frame of the method, which may be gone by the time the lambda runs (e.g. on another thread). Java copies the value into the lambda; allowing later reassignment would make the copy silently stale and invite data races. Use a field, an array element or an `AtomicInteger` if you really need mutable state — or better, restructure with a stream reduction.
```

```question
What does String::compareTo mean when a Comparator&lt;String&gt; is expected?

---

It's an <em>unbound</em> instance-method reference: the first parameter becomes the receiver. `(a, b) -> a.compareTo(b)`. That's why a two-argument functional interface can be satisfied by a one-argument instance method.
```
