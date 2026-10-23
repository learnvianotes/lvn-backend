---
id: 9dc8b3f2-edc6-7265-b488-882d4e5aa641
key: topic:java/modern-java
subject: java
topic: modern-java
title: "Modern Java: 8 → 21 Feature Tour"
slug: modern-java-8-21-feature-tour
order: 1
---

What changed from Java 8 to Java 21 — the features interviewers expect you to know and modern codebases actually use.

> [!NOTE] LTS
>
> Long-term-support releases: <strong>8, 11, 17, 21</strong> (and 25). Since Java 10 a feature release ships every six months; preview features need `--enable-preview`.

# Feature timeline

| Version | Headline features |
| --- | --- |
| <strong>8</strong> (2014, LTS) | Lambdas, method references, Streams, `Optional`, `java.time`, default &amp; static interface methods, `CompletableFuture` |
| 9 | Module system (JPMS), `List.of` / `Set.of` / `Map.of`, JShell, private interface methods, `Stream.takeWhile`, compact strings |
| 10 | `var` for local variables, `List.copyOf`, `Collectors.toUnmodifiableList` |
| <strong>11</strong> (LTS) | `String.isBlank/strip/repeat/lines`, `Files.readString/writeString`, standard `HttpClient`, single-file launch `java App.java`, `var` in lambda params |
| 12–13 | `Collectors.teeing`, `String.indent/transform`; switch expressions &amp; text blocks in preview |
| 14 | <strong>Switch expressions</strong> (`->`, `yield`), helpful `NullPointerException` messages |
| 15 | <strong>Text blocks</strong> `"""`, `String.formatted`, ZGC production-ready |
| 16 | <strong>Records</strong>, <strong>pattern matching for </strong><strong>`instanceof`</strong>, `Stream.toList()` |
| <strong>17</strong> (LTS) | <strong>Sealed classes</strong>, strong encapsulation of JDK internals, `RandomGenerator` |
| 18–20 | UTF-8 by default, simple web server `jwebserver`; previews of virtual threads, record patterns |
| <strong>21</strong> (LTS) | <strong>Virtual threads</strong>, <strong>pattern matching for </strong><strong>`switch`</strong>, <strong>record patterns</strong>, <strong>sequenced collections</strong> (`getFirst`, `reversed`), generational ZGC |

# Many features, one program

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    sealed interface Shape permits Circle, Rect {}             // 17: sealed
    record Circle(double r) implements Shape {}                 // 16: records
    record Rect(double w, double h) implements Shape {}

    static String describe(Object o) {
        return switch (o) {                                     // 21: pattern switch
            case Circle(double r) when r > 10 -> "big circle";  // 21: record pattern + guard
            case Circle c -> "circle r=" + c.r();
            case Rect(double w, double h) -> "rect " + (w * h);
            case String s -> "text of length " + s.length();
            case null -> "null!";
            default -> "something else";
        };
    }

    public static void main(String[] args) {
        var shapes = List.of(new Circle(2), new Rect(3, 4), new Circle(20));   // 10: var, 9: List.of
        shapes.forEach(s -> System.out.println(describe(s)));                 // 8: lambdas
        System.out.println(describe("hi") + ", " + describe(null));

        Object o = shapes.get(1);
        if (o instanceof Rect r && r.w() < r.h()) {                             // 16: instanceof pattern
            System.out.println("tall " + r);
        }

        String json = """
                {"name": "%s", "ok": %b}""".formatted("java", true);          // 15: text block + formatted
        System.out.println(json);

        System.out.println("  hi  ".strip() + "|" + "ab".repeat(3) + "|" + "   ".isBlank());   // 11

        var names = new ArrayList<>(List.of("a", "b", "c"));
        System.out.println(names.getFirst() + names.getLast() + " " + names.reversed());    // 21: sequenced

        List<String> kinds = shapes.stream().map(s -> s.getClass().getSimpleName()).toList();   // 16: toList()
        System.out.println(kinds);
    }
}
```

```text filename:Output
circle r=2.0
rect 12.0
big circle
text of length 2, null!
tall Rect[w=3.0, h=4.0]
{"name": "java", "ok": true}
hi|ababab|true
ac [c, b, a]
[Circle, Rect, Circle]
```

# Helpful NullPointerExceptions (14+)

```java filename:Java
public class Main {
    record Address(String city) {}
    record User(Address address) {}

    public static void main(String[] args) {
        User u = new User(null);
        try {
            System.out.println(u.address().city().length());
        } catch (NullPointerException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

```text filename:Output
Cannot invoke "Main$Address.city()" because the return value of "Main$User.address()" is null
```

# Virtual threads (21)

```java filename:Java
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) {
        AtomicInteger done = new AtomicInteger();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < 10_000; i++) {
                executor.submit(() -> {
                    Thread.sleep(10);                 // blocking is cheap on a virtual thread
                    return done.incrementAndGet();
                });
            }
        }                                             // close() waits for all tasks
        System.out.println("completed: " + done.get());
    }
}
```

```text filename:Output
completed: 10000
```

```question
Which Java version would you pick for a new project and why?

---

The latest LTS (21, or 25 if the stack supports it): records, sealed types, pattern matching and virtual threads are all final, and it gets long-term security updates. Frameworks like Spring Boot 3 require at least 17.
```

```question
What are the headline features of Java 8?

---

Lambda expressions and functional interfaces, method references, the Streams API, `Optional`, the `java.time` API, default and static methods in interfaces, and `CompletableFuture`.
```

```question
What is pattern matching in Java 21?

---

`switch` can test the <em>type</em> of the selector (`case String s ->`), deconstruct records (`case Point(int x, int y) ->`), add guards (`when x > 0`) and handle `case null`. With sealed hierarchies, the compiler checks exhaustiveness so no `default` is needed.
```
