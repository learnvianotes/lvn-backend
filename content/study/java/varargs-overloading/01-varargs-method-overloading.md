---
id: 6bce66e1-99f5-7213-842f-dd68adea0ae1
key: topic:java/varargs-overloading
subject: java
topic: varargs-overloading
title: Varargs & Method Overloading
slug: varargs-method-overloading
order: 1
---

Overloading = same name, different parameter lists, chosen at <em>compile time</em>. Varargs (`T...`) lets a method accept zero or more arguments as an array.

# Overloading

```java filename:Java
public class Main {
    static int area(int side) { return side * side; }
    static int area(int w, int h) { return w * h; }
    static double area(double r) { return Math.PI * r * r; }

    public static void main(String[] args) {
        System.out.println(area(3));
        System.out.println(area(2, 5));
        System.out.printf("%.2f%n", area(1.0));
    }
}
```

```text filename:Output
9
10
3.14
```

Overloads must differ in the <strong>number, types or order</strong> of parameters. Different return types, parameter names, or exceptions alone are not enough.

# Varargs

```java filename:Java
import java.util.Arrays;

public class Main {
    static int sum(int... nums) {                   // nums is an int[]
        int total = 0;
        for (int n : nums) total += n;
        return total;
    }

    static String tag(String name, Object... attrs) {   // varargs must be LAST
        return name + Arrays.toString(attrs);
    }

    public static void main(String[] args) {
        System.out.println(sum() + " " + sum(1) + " " + sum(1, 2, 3));
        System.out.println(sum(new int[]{4, 5}));       // can pass an array directly
        System.out.println(tag("div", "id", 7, true));
        System.out.println(String.format("%s-%s", "a", "b"));   // printf/format use varargs
    }
}
```

```text filename:Output
0 1 6
9
div[id, 7, true]
a-b
```

- Only <strong>one</strong> varargs parameter per method, and it must be the <strong>last</strong> one.
- Inside the method it is an ordinary array (possibly empty, never `null` unless the caller passes `null`).
- Each call allocates a new array — hot paths often add fixed-arity overloads (like `List.of(e1, e2, …)`).

# Overload resolution: which method wins?

1. <strong>Phase 1 — exact / widening</strong>

   Match without boxing or varargs; primitive widening allowed (`int` → `long` → `float` → `double`).

2. <strong>Phase 2 — boxing / unboxing</strong>

   Allow `int` ↔ `Integer`, then widening of references (`Integer` → `Number` → `Object`).

3. <strong>Phase 3 — varargs</strong>

   Only if nothing matched in phases 1–2.

4. <strong>Most specific</strong>

   If several match in the same phase, the most specific wins; if none is more specific → <em>ambiguous</em> compile error.

```java filename:Java
public class Main {
    static void f(long x)    { System.out.println("long (widening)"); }
    static void f(Integer x) { System.out.println("Integer (boxing)"); }
    static void f(int... x)  { System.out.println("int... (varargs)"); }

    static void g(Object o)  { System.out.println("g(Object)"); }
    static void g(String s)  { System.out.println("g(String)"); }

    static void h(double d)  { System.out.println("h(double)"); }
    static void h(Object o)  { System.out.println("h(Object)"); }

    public static void main(String[] args) {
        f(5);              // widening beats boxing beats varargs
        f(Integer.valueOf(5));
        f();
        g(null);           // String is more specific than Object
        g((Object) "hi");  // static (compile-time) type decides
        h('A');            // char → double widening wins over boxing to Character
    }
}
```

```text filename:Output
long (widening)
Integer (boxing)
int... (varargs)
g(String)
g(Object)
h(double)
```

> [!WARNING] Watch out
>
> Overloads are chosen from the <strong>compile-time (static) types</strong> of the arguments, not the runtime objects. `Object o = "hi"; g(o);` calls `g(Object)`. Contrast with overriding, which is chosen at runtime.

```java filename:Java
public class Main {
    static void k(Integer a, long b) {}
    static void k(long a, Integer b) {}

    public static void main(String[] args) {
        k(1, 2);          // error: reference to k is ambiguous
    }
}
```

# A classic trap: `List.remove`

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(10, 20, 30, 1));
        list.remove(1);                       // remove(int index) → removes 20
        System.out.println(list);
        list.remove(Integer.valueOf(1));      // remove(Object) → removes the value 1
        System.out.println(list);
    }
}
```

```text filename:Output
[10, 30, 1]
[10, 30]
```

```question
Can we overload main?

---

Yes — you can declare other `main` methods with different parameters, but the JVM only starts the program with `public static void main(String[] args)` (or `String...`).
```

```question
What is the priority order in overload resolution?

---

Exact match / primitive widening first, then boxing/unboxing, then varargs. Within a phase the most specific method is chosen; if none is most specific the call is ambiguous and won't compile.
```

```question
Is void f(int\[\] a) vs void f(int... a) a valid overload?

---

No — varargs compiles to an array parameter, so both have the same signature `f(int[])`: a <em>duplicate method</em> compile error.
```
