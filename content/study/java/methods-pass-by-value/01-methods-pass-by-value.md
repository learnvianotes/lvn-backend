---
id: dc4376e5-374e-7cfc-ab21-65e9810ca5ad
key: topic:java/methods-pass-by-value
subject: java
topic: methods-pass-by-value
title: Methods & Pass-by-Value
slug: methods-pass-by-value
order: 1
---

Java is <strong>always pass-by-value</strong>. For objects, the value passed is a copy of the <em>reference</em> — so you can mutate the object, but never reseat the caller's variable.

# Anatomy of a method

```java filename:Java
public class Main {
    //  modifiers   return type  name   parameters        throws clause
    public static   int          add(   int a, int b)    /* throws … */ {
        return a + b;
    }

    static void greet(String name) {           // void: returns nothing
        if (name == null) return;              // early return
        System.out.println("Hi " + name);
    }

    public static void main(String[] args) {
        System.out.println(add(2, 3));
        greet("Asha");
        greet(null);
    }
}
```

```text filename:Output
5
Hi Asha
```

| Part | Meaning |
| --- | --- |
| <strong>Signature</strong> | Name + parameter <em>types</em> (e.g. `add(int, int)`). Return type and parameter names are <strong>not</strong> part of it. |
| Access modifier | `public`, `protected`, package-private (none), `private` |
| `static` | Belongs to the class — call as `Main.add(…)` without an object |
| Return type | Any type or `void`; every path of a non-void method must `return` or throw |
| Parameters | Local variables initialized with copies of the arguments |

# Pass-by-value, demonstrated

```java filename:Java
import java.util.*;

public class Main {
    static void bump(int x) { x++; }                          // changes the copy only

    static void mutate(List<String> list) { list.add("added"); }   // same object → visible

    static void reassign(List<String> list) {
        list = new ArrayList<>();                             // local copy now points elsewhere
        list.add("lost");
    }

    static void swap(Integer a, Integer b) { Integer t = a; a = b; b = t; }

    public static void main(String[] args) {
        int n = 5;
        bump(n);
        System.out.println(n);

        List<String> items = new ArrayList<>(List.of("x"));
        mutate(items);
        reassign(items);
        System.out.println(items);

        Integer p = 1, q = 2;
        swap(p, q);
        System.out.println(p + " " + q);                      // swap is impossible this way
    }
}
```

```text filename:Output
5
[x, added]
1 2
```

caller: `items` → \[list object\] → call copies the reference → param `list` → same \[list object\] → `list = new …` rebinds only the param

> [!WARNING] Watch out
>
> “Objects are passed by reference” is a common but wrong interview answer. The <em>reference</em> is passed by value: the method gets its own copy of the pointer.

# Return values &amp; multiple results

```java filename:Java
public class Main {
    record MinMax(int min, int max) {}                 // return several values via a record

    static MinMax range(int... xs) {
        int lo = Integer.MAX_VALUE, hi = Integer.MIN_VALUE;
        for (int x : xs) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        return new MinMax(lo, hi);
    }

    public static void main(String[] args) {
        MinMax r = range(4, -2, 9, 0);
        System.out.println(r + " -> " + r.min() + ".." + r.max());
    }
}
```

```text filename:Output
MinMax[min=-2, max=9] -> -2..9
```

# Local variables &amp; scope

- Local variables have <strong>no default value</strong> — using one before assignment is a compile error (fields do get defaults).
- A variable's scope is its enclosing block `{ … }`; you can't redeclare a name that is already in scope in the same method.
- `var` (Java 10) infers a local's type: `var list = new ArrayList<String>();` — locals only, must be initialized.
- Parameters can be `final` to document that they're not reassigned.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int x;
        System.out.println(x);       // error: variable x might not have been initialized
    }
}
```

```question
Is Java pass-by-value or pass-by-reference?

---

Strictly pass-by-value. Primitives: the value is copied. Objects: the reference is copied — the method can mutate the shared object but reassigning the parameter never affects the caller's variable. That's why a `swap(a, b)` method can't work.
```

```question
Can two methods differ only by return type?

---

No. The signature is name + parameter types; `int f()` and `long f()` in the same class is a compile error because a call `f()` would be ambiguous.
```

```question
What does static mean for a method?

---

It belongs to the class, not an instance: no `this`, can't access instance fields directly, and it is resolved at compile time (not overridden — only hidden).
```
