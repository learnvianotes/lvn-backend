---
id: 52339d09-a91b-742d-84b6-6473c4753e1b
key: topic:java/primitive-types
subject: java
topic: primitive-types
title: Primitive Types & Variables
slug: primitive-types-variables
order: 1
---

Java has exactly <strong>8 primitive types</strong> with fixed sizes on every platform; everything else is a <em>reference</em> to an object.

# The 8 primitives

| Type | Size | Range / values | Default | Literal |
| --- | --- | --- | --- | --- |
| `byte` | 8 bit | −128 … 127 | `0` | `(byte) 10` |
| `short` | 16 bit | −32,768 … 32,767 | `0` | `(short) 10` |
| `int` | 32 bit | −2³¹ … 2³¹−1 (≈ ±2.1 billion) | `0` | `42`, `0x2A`, `0b101010`, `1_000_000` |
| `long` | 64 bit | −2⁶³ … 2⁶³−1 (≈ ±9.2 × 10¹⁸) | `0L` | `42L` |
| `float` | 32 bit | IEEE 754, \~7 significant digits | `0.0f` | `3.14f` |
| `double` | 64 bit | IEEE 754, \~15–16 significant digits | `0.0d` | `3.14`, `1e-9` |
| `char` | 16 bit | UTF-16 code unit `'\u0000'` … `'\uffff'` (unsigned) | `'\u0000'` | `'A'`, `'\n'`, `'\u0041'` |
| `boolean` | JVM-dependent | `true` / `false` (not 0/1!) | `false` | `true` |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(Byte.MIN_VALUE + " " + Byte.MAX_VALUE);
        System.out.println(Integer.MAX_VALUE + " " + Long.MAX_VALUE);
        System.out.println((int) Character.MAX_VALUE + " " + Character.SIZE + " bits");
        int million = 1_000_000;                   // underscores for readability
        System.out.println(million + " " + 0xFF + " " + 0b1010 + " " + 017);
        char c = 'A';
        System.out.println(c + 1);                 // char promoted to int
        System.out.println((char) (c + 1));
    }
}
```

```text filename:Output
-128 127
2147483647 9223372036854775807
65535 16 bits
1000000 255 10 15
66
B
```

> [!WARNING] Watch out
>
> A leading `0` makes an <em>octal</em> literal: `017` is 15, and `09` doesn't compile.

# Variables: local, instance, static

| Kind | Declared | Lives in | Default value? |
| --- | --- | --- | --- |
| Local | Inside a method/block | Stack frame | <strong>No</strong> — must be assigned before use (compile error otherwise) |
| Instance (field) | In the class, no `static` | Inside each object on the heap | Yes (`0`, `false`, `null`) |
| Static (class variable) | `static` in the class | Once per class | Yes |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int x;
        System.out.println(x);   // local variable never assigned
    }
}
```

```text filename:Compiler%20error
Main.java:4: error: variable x might not have been initialized
        System.out.println(x);   // local variable never assigned
                           ^
1 error
```

# `var` — local type inference (Java 10+)

```java filename:Java
import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        var count = 10;                       // int
        var price = 9.99;                     // double
        var names = new ArrayList<String>();  // ArrayList<String>
        names.add("Ada");
        for (var n : names) System.out.println(n + " " + count + " " + price);
    }
}
```

```text filename:Output
Ada 10 9.99
```

- Still <strong>static typing</strong> — the compiler infers the type once; it can't change later.
- Only for local variables with an initialiser (and loop variables). Not for fields, parameters or return types.
- `var x = null;` and `var a = {1, 2};` don't compile — there's nothing to infer from.

# Integer overflow &amp; floating-point surprises

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int big = Integer.MAX_VALUE;
        System.out.println(big + 1);                   // wraps around silently
        long ok = big + 1L;                            // do the math in long
        System.out.println(ok);
        System.out.println(1_000_000 * 1_000_000);     // int * int overflows
        System.out.println(1_000_000L * 1_000_000);
        try {
            Math.addExact(big, 1);
        } catch (ArithmeticException e) {
            System.out.println("addExact: " + e.getMessage());
        }
        System.out.println(0.1 + 0.2);
        System.out.println(0.1f + 0.2f);
        System.out.println(1.0 / 0 + " " + -1.0 / 0 + " " + 0.0 / 0);
    }
}
```

```text filename:Output
-2147483648
2147483648
-727379968
1000000000000
addExact: integer overflow
0.30000000000000004
0.3
Infinity -Infinity NaN
```

> [!WARNING] Watch out
>
> Integer overflow is <strong>silent</strong> in Java. Use `long`, `Math.addExact`/`multiplyExact` (which throw), or `BigInteger`. For money, never use `double` — use `BigDecimal` or integer cents.

```java filename:Java
import java.math.BigDecimal;
import java.math.BigInteger;

public class Main {
    public static void main(String[] args) {
        System.out.println(new BigDecimal("0.1").add(new BigDecimal("0.2")));
        System.out.println(new BigDecimal(0.1));    // the double's exact binary value!
        BigInteger f = BigInteger.ONE;
        for (int i = 2; i <= 25; i++) f = f.multiply(BigInteger.valueOf(i));
        System.out.println("25! = " + f);
    }
}
```

```text filename:Output
0.3
0.1000000000000000055511151231257827021181583404541015625
25! = 15511210043330985984000000
```

```question
Why is char 16 bits in Java?

---

Java was designed around Unicode, and in 1995 Unicode fit in 16 bits. A `char` is a UTF-16 <em>code unit</em>; characters outside the Basic Multilingual Plane (e.g. many emoji) need two `char`s (a surrogate pair).
```

```question
What are default values, and do local variables get them?

---

Fields and array elements get defaults (`0`, `0.0`, `false`, `'\u0000'`, `null`). Local variables do <strong>not</strong> — the compiler rejects reading one before it's definitely assigned.
```

```question
Does var make Java dynamically typed?

---

No. `var` is compile-time inference only; the variable has one fixed static type, exactly as if you had written it out.
```
