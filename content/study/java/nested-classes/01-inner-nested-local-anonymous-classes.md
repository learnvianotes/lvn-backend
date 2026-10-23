---
id: 310e1397-5b6d-723f-b046-4c17ab8cba2a
key: topic:java/nested-classes
subject: java
topic: nested-classes
title: Inner, Nested, Local & Anonymous Classes
slug: inner-nested-local-anonymous-classes
order: 1
---

A class can be declared <em>inside</em> another class, method or expression. The four kinds differ in one key way: whether they hold a hidden reference to an enclosing instance.

> [!INFO]
>
> <strong>Nested class</strong> — any class declared inside another class. A <strong>static nested</strong> class is just a namespaced top-level class; a non-static one is an <strong>inner</strong> class and is tied to an instance of the outer class.

# The four kinds at a glance

| Kind | Declared | Outer instance? | Typical use |
| --- | --- | --- | --- |
| <strong>Static nested</strong> | `static class Node` inside a class | No | Helpers that belong with the outer class: `Map.Entry`, `Builder`, linked-list `Node` |
| <strong>Inner (member)</strong> | `class Itr` inside a class | <strong>Yes</strong> — `Outer.this` | Iterators and views that need the outer object's fields |
| <strong>Local</strong> | `class X` inside a method body | Yes, if in an instance method | A one-method helper type with a name |
| <strong>Anonymous</strong> | `new Interface() { … }` expression | Yes, if in an instance context | One-off implementation; mostly replaced by lambdas |

# Static nested vs inner

```java filename:Java
public class Main {
    private int size = 3;
    private static String kind = "outer";

    static class StaticNested {            // no outer instance
        String describe() { return "nested sees " + kind; }   // only static members
    }

    class Inner {                          // bound to a Main instance
        int size = 10;
        String describe() {
            return "inner " + size + ", outer " + Main.this.size;
        }
    }

    public static void main(String[] args) {
        StaticNested n = new StaticNested();          // no Main needed
        System.out.println(n.describe());

        Main outer = new Main();
        Main.Inner in = outer.new Inner();            // needs an outer instance
        System.out.println(in.describe());
    }
}
```

```text filename:Output
nested sees outer
inner 10, outer 3
```

> [!NOTE] Key point
>
> Inside an inner class, `this` is the inner object and `Main.this` is the enclosing one. Use the qualified form when a field name is shadowed.

# Local and anonymous classes

```java filename:Java
import java.util.*;

public class Main {
    interface Greeter { String greet(String name); }

    public static void main(String[] args) {
        String greeting = "Hello";                  // effectively final → can be captured

        class Polite implements Greeter {           // local class: has a name, lives in this method
            public String greet(String name) { return greeting + ", " + name + "!"; }
        }

        Greeter shout = new Greeter() {             // anonymous class: no name, one instance
            @Override
            public String greet(String name) { return greeting.toUpperCase() + " " + name; }
        };

        Greeter lambda = name -> greeting + " " + name;   // same thing, as a lambda

        System.out.println(new Polite().greet("Asha"));
        System.out.println(shout.greet("Ravi"));
        System.out.println(lambda.greet("Mei"));

        List<String> names = new ArrayList<>(List.of("bob", "Al", "carol"));
        names.sort(new Comparator<String>() {       // classic pre-Java-8 style
            public int compare(String a, String b) { return a.length() - b.length(); }
        });
        System.out.println(names);
    }
}
```

```text filename:Output
Hello, Asha!
HELLO Ravi
Hello Mei
[Al, bob, carol]
```

# Capturing variables: effectively final

Local, anonymous classes and lambdas can read local variables of the enclosing method only if they are <strong>final or effectively final</strong> (never reassigned). The value is <em>copied</em> into the object, so allowing later changes would make the copy and the variable disagree.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int count = 0;
        Runnable r = () -> System.out.println(count);
        count++;                 // makes count not effectively final
        r.run();
    }
}
```

```text filename:Compiler%20error
Main.java:4: error: local variables referenced from a lambda expression must be final or effectively final
        Runnable r = () -> System.out.println(count);
                                              ^
```

> [!TIP] Do
>
> Need a mutable counter inside a lambda? Use an `AtomicInteger`, a one-element array, or — better — restructure with a stream.

# Anonymous class vs lambda

|  | Anonymous class | Lambda |
| --- | --- | --- |
| Implements | Any interface or abstract/concrete class, many methods | Only a <strong>functional interface</strong> (one abstract method) |
| `this` means | The anonymous object itself | The <strong>enclosing</strong> instance |
| State | Can have fields | No fields of its own |
| Compiled to | A separate `Main$1.class` file | `invokedynamic` — no extra class file |

> [!WARNING] Memory leak
>
> Every inner/anonymous class created in an instance method keeps a hidden reference to `Outer.this`. If it outlives the outer object (a listener, a cached task, a `Runnable` handed to a thread) it keeps the whole outer object alive — a classic <strong>memory leak</strong> (e.g. Android Activities). Prefer `static` nested classes unless you really need the outer instance.

```question
Static nested vs inner class — when to use which?

---

Default to <strong>static nested</strong>: it's cheaper (no hidden outer reference), can be created without an outer instance, and can't leak the outer object. Use an <strong>inner</strong> class only when it must read or write the outer instance's state, like an iterator over the outer collection.
```

```question
Why must captured local variables be effectively final?

---

The lambda/anonymous object gets a <em>copy</em> of the value (locals live on the stack and may be gone when the object runs). If the variable could change afterwards, the copy would silently be stale, so Java forbids it at compile time.
```

```question
What does this refer to inside a lambda vs an anonymous class?

---

In an anonymous class, `this` is the anonymous object. A lambda has no identity of its own, so `this` is the enclosing class instance.
```
