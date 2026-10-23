---
id: ce3f5f08-54c2-78c1-9226-992ef024249b
key: topic:java/access-packages
subject: java
topic: access-packages
title: Access Modifiers & Packages
slug: access-modifiers-packages
order: 1
---

Packages group related classes into namespaces; access modifiers decide who may see each class and member.

# The four access levels

| Modifier | Same class | Same package | Subclass (other package) | Everywhere |
| --- | --- | --- | --- | --- |
| `private` | Yes | No | No | No |
| <em>(default / package-private)</em> | Yes | Yes | No | No |
| `protected` | Yes | Yes | Yes (through inheritance) | No |
| `public` | Yes | Yes | Yes | Yes |

> [!NOTE] Key point
>
> Order from most to least restrictive: `private` → default → `protected` → `public`. Start with `private` and widen only when needed.

# Where each modifier is allowed

- <strong>Top-level classes</strong>: only `public` or default. A source file may contain at most one `public` top-level class, and the file must be named after it.
- <strong>Members</strong> (fields, methods, constructors, nested types): all four.
- <strong>Local variables</strong>: no access modifiers at all (only `final`).
- <strong>Interface members</strong>: `public` by default; methods may also be `private` (Java 9+).

# `private` is per class, not per object

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Money a = new Money(500);
        Money b = new Money(300);
        System.out.println(a.isMoreThan(b));
        // System.out.println(a.cents);   // error: cents has private access in Money
    }
}

class Money {
    private final long cents;
    Money(long cents) { this.cents = cents; }

    boolean isMoreThan(Money other) {
        return this.cents > other.cents;   // OK: other object, same class
    }
}
```

```text filename:Output
true
```

# Packages

> [!INFO]
>
> <strong>Package</strong> — a namespace that groups related types and maps to a directory: `package com.shop.billing;` lives in `com/shop/billing/`. The fully qualified name is `com.shop.billing.Invoice`.

```filename:Terminal
src/com/shop/billing/Invoice.java     # package com.shop.billing;
src/com/shop/app/Main.java            # package com.shop.app;  import com.shop.billing.Invoice;

$ javac -d out $(find src -name '*.java')
$ java -cp out com.shop.app.Main
```

- Naming: reversed domain, all lowercase — `com.google.common.collect`.
- `java.lang` is imported automatically (`String`, `Math`, `Integer`, `System`…).
- Sub-packages are <strong>not</strong> related for access: `com.shop` cannot see package-private members of `com.shop.billing`.
- Classes without a `package` line are in the <em>unnamed package</em> — fine for scripts, never for real projects.

# Imports

```java filename:Java
import java.util.*;                        // on-demand: every public type in java.util
import java.time.LocalDate;                // single-type import (preferred)
import static java.lang.Math.max;          // static import of one member
import static java.lang.Math.PI;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(3, 9, 4));
        System.out.println(max(nums.get(0), nums.get(1)));
        System.out.printf("%.2f%n", PI);
        System.out.println(LocalDate.of(2024, 2, 29).plusDays(1));
        java.util.Date legacy = null;      // fully qualified name, no import needed
        System.out.println(legacy);
    }
}
```

```text filename:Output
9
3.14
2024-03-01
null
```

> [!WARNING] Watch out
>
> An import is only a compile-time shortcut for names — it loads nothing and has no runtime cost. `import java.util.*` does <strong>not</strong> import sub-packages like `java.util.function`.

# `protected` in practice

`protected` members are visible to the whole package <em>plus</em> subclasses elsewhere — but a subclass in another package can only use them through its own type (`this` or a subclass reference), not through an arbitrary parent-class object.

```question
Can a top-level class be private or protected?

---

No — only `public` or package-private. Nested classes can use all four modifiers.
```

```question
What is the default access level?

---

Package-private: visible to every class in the same package and nowhere else — not even to subclasses in other packages.
```

```question
Can an overriding method reduce visibility?

---

No. An override may keep or widen access (`protected` → `public`) but never narrow it, otherwise code written against the parent type would break.
```
