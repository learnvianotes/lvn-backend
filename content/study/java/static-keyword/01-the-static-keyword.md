---
id: 8c3467eb-2130-7fb7-87b1-2074790a52d1
key: topic:java/static-keyword
subject: java
topic: static-keyword
title: The static Keyword
slug: the-static-keyword
order: 1
---

`static` members belong to the class, not to any object: one copy, shared by all instances, usable without `new`.

# Where `static` can appear

| On | Meaning | Typical use |
| --- | --- | --- |
| Field | One copy per class (in the class's data, not in each object) | Counters, constants (`static final`), caches |
| Method | Called on the class; no `this` | Utilities (`Math.max`), factories (`List.of`) |
| Block `static { }` | Runs once when the class is initialised | Complex static setup |
| Nested class | A class inside a class that needs no outer instance | Builders, helper types, `Map.Entry` |
| Import | `import static java.lang.Math.*;` | Use `sqrt(x)` without the class name |

# Static field vs instance field

```java filename:Java
public class Main {
    public static void main(String[] args) {
        User a = new User("asha");
        User b = new User("ravi");
        User c = new User("meera");
        System.out.println(a.id + " " + b.id + " " + c.id);
        System.out.println("users created: " + User.created);
        System.out.println(User.isValidName("x"));   // static method: no object needed
    }
}

class User {
    static int created = 0;   // shared by all Users
    final int id;             // each User has its own
    final String name;

    User(String name) {
        this.name = name;
        this.id = ++created;
    }

    static boolean isValidName(String s) {
        // return name.length() > 1;   // would not compile: no 'this' in a static method
        return s.length() > 1;
    }
}
```

```text filename:Output
1 2 3
users created: 3
false
```

# What a static method can and cannot touch

> [!NOTE] Can
>
> Other static fields and methods directly; instance members <em>through an object reference</em> (`u.name`).

> [!NOTE] Cannot
>
> Instance fields/methods directly, `this`, `super`. Static methods are also not polymorphic — they are <em>hidden</em>, not overridden.

# Static blocks and lazy initialisation

```java filename:Java
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        System.out.println("main starts");
        System.out.println(Codes.lookup("IN"));
        System.out.println(Codes.lookup("JP"));
    }
}

class Codes {
    private static final Map<String, String> NAMES;
    static {
        System.out.println("Codes initialised");   // runs on first use, once
        NAMES = Map.of("IN", "India", "JP", "Japan");
    }
    static String lookup(String code) { return NAMES.get(code); }
}
```

```text filename:Output
main starts
Codes initialised
India
Japan
```

> [!NOTE] Key point
>
> A class is initialised lazily, on its <strong>first active use</strong> (creating an instance, calling a static method, reading a non-constant static field). That is what makes the <em>holder idiom</em> singleton lazy and thread-safe.

# Why is `main` static?

The JVM must call `main` before any object of your class exists. Making it `static` lets the launcher invoke `Main.main(args)` directly on the class without having to choose a constructor.

# Static nested class

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Order.Line line = new Order.Line("pen", 3);   // no Order instance needed
        System.out.println(line.item() + " x" + line.qty());
    }
}

class Order {
    record Line(String item, int qty) { }   // nested records/enums/interfaces are implicitly static
}
```

```text filename:Output
pen x3
```

> [!WARNING] Watch out
>
> Mutable `static` state is global state: it is shared across all threads and tests and never garbage-collected while the class is loaded. Prefer `static final` constants and stateless static helpers.

```question
Can we override a static method?

---

No. A static method with the same signature in a subclass <em>hides</em> the parent's one. Which version runs is chosen at compile time from the reference type, not the object.
```

```question
Can a static method access instance variables?

---

Not directly — there is no `this`. It can only reach them through an explicit object reference passed in or created inside it.
```

```question
When is a static block executed?

---

Once, when the class is initialised — at its first active use — after the class is loaded and linked. Multiple static blocks run in source order.
```
