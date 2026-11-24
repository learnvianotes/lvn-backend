---
id: b65bf087-1d8d-7b90-9f53-c8c03d56073e
key: topic:java/string-memory-traps
subject: java
topic: string-memory-traps
title: String & Memory Interview Traps
slug: string-memory-interview-traps
order: 1
---

A collection of classic “what does this print?” questions about strings, the pool, boxing and constant folding — each verified.

# == on strings

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String a = "java";
        String b = "java";                 // same pooled literal
        String c = new String("java");     // a new heap object
        String d = "ja" + "va";            // compile-time constant → folded to "java"
        String part = "ja";
        String e = part + "va";            // runtime concatenation → new object
        final String fpart = "ja";
        String f = fpart + "va";           // final + literal is a constant → folded

        System.out.println(a == b);
        System.out.println(a == c);
        System.out.println(a == d);
        System.out.println(a == e);
        System.out.println(a == f);
        System.out.println(a == e.intern());
        System.out.println(a.equals(c));
    }
}
```

```text filename:Output
true
false
true
false
true
true
true
```

| Expression | Pooled? | Why |
| --- | --- | --- |
| `"java"` | Yes | Every string literal is interned in the pool |
| `new String("java")` | No | `new` always creates a fresh heap object |
| `"ja" + "va"` | Yes | Constant expression, folded by `javac` |
| `part + "va"` (non-final `part`) | No | Computed at run time (`StringConcatFactory` / `StringBuilder`) |
| `fpart + "va"` (`final` with constant initialiser) | Yes | `fpart` is a <em>constant variable</em>, so the whole expression is constant |
| `s.intern()` | Yes | Returns the pooled instance, adding it if absent |

> [!NOTE] Key point
>
> Rule: compare strings with `equals` (or `Objects.equals` for null-safety). `==` only tells you whether two references point at the same object.

```question
How many objects does new String("hello") create?

---

Up to two: the literal `"hello"` is placed in the string pool when the class is loaded (if it isn't already there), and `new` creates one more `String` object on the heap. If the literal was already pooled, only one new object is created at run time.
```

# Integer cache and boxing

```java filename:Java
public class Main {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        Integer c = 128, d = 128;
        System.out.println(a == b);          // cached: -128..127
        System.out.println(c == d);          // two different objects
        System.out.println(c.equals(d));

        Long big = 127L;
        System.out.println(big.equals(127));  // Integer vs Long → false
        System.out.println(big == 127);       // unboxed numeric comparison → true

        Integer missing = null;
        try {
            int n = missing;                  // auto-unboxing null
            System.out.println(n);
        } catch (NullPointerException ex) {
            System.out.println("NPE on unboxing");
        }

        boolean flag = true;
        try {
            int r = flag ? missing : 0;       // ternary unboxes `missing`
            System.out.println(r);
        } catch (NullPointerException ex) {
            System.out.println("NPE in ternary");
        }
    }
}
```

```text filename:Output
true
false
true
false
true
NPE on unboxing
NPE in ternary
```

> [!WARNING] Watch out
>
> The cache covers `Integer`, `Short`, `Long`, `Byte` in −128…127, `Character` up to 127 and both `Boolean` values. The upper bound for `Integer` can be raised with `-XX:AutoBoxCacheMax`, so `==` on boxed numbers is never reliable.

# Concatenation and char arithmetic

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println("a" + 1 + 2);      // left to right: ("a" + 1) + 2
        System.out.println(1 + 2 + "a");      // (1 + 2) + "a"
        System.out.println('a' + 'b');        // char + char → int
        System.out.println("" + 'a' + 'b');
        System.out.println((char) ('a' + 1));
        System.out.println(Math.abs(Integer.MIN_VALUE));   // overflow: no positive counterpart
        System.out.println(0.1 + 0.2);
    }
}
```

```text filename:Output
a12
3a
195
ab
b
-2147483648
0.30000000000000004
```

# String + in a loop

Each `s += x` creates a brand-new string and copies everything so far — O(n²) for n appends. Inside loops use a `StringBuilder` (single-expression concatenations are fine: the compiler optimises them).

```java filename:Java
public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            sb.append(i).append(',');
        }
        sb.setLength(sb.length() - 1);            // drop the trailing comma
        System.out.println(sb);

        System.out.println(String.join(",", "a", "b", "c"));   // often simplest
    }
}
```

```text filename:Output
0,1,2,3,4
a,b,c
```

# Other traps

> [!NOTE] substring copies
>
> Before Java 7u6, `substring` shared the parent's `char[]` — a tiny substring could pin a huge string in memory. Now it copies, so no leak (but O(k) cost).

> [!NOTE] Passwords in char[]
>
> A `String` is immutable and may be pooled; it lingers in memory until GC and can show up in heap dumps. A `char[]` can be wiped with `Arrays.fill(pw, '\0')` right after use — that's why `Console.readPassword()` returns `char[]`.

> [!NOTE] Compact strings (9+)
>
> Strings that contain only Latin-1 characters store one byte per char instead of two (`byte[]` + a coder flag).

> [!NOTE] Strings are immutable
>
> `s.toUpperCase()` returns a new string; calling it without assigning the result does nothing.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String s = "hello";
        s.toUpperCase();                   // result discarded
        System.out.println(s);
        s = s.toUpperCase();
        System.out.println(s);
    }
}
```

```text filename:Output
hello
HELLO
```

# switch on strings and null

A `switch` on a `String` compiles to a switch on `hashCode()` followed by `equals()`. A `null` selector throws `NullPointerException` — unless (Java 21) you add `case null`.

```java filename:Java
public class Main {
    static String classic(String cmd) {
        switch (cmd) {
            case "start": return "starting";
            case "stop":  return "stopping";
            default:      return "unknown";
        }
    }

    static String modern(String cmd) {
        return switch (cmd) {
            case null -> "no command";            // Java 21
            case "start" -> "starting";
            default -> "unknown";
        };
    }

    public static void main(String[] args) {
        System.out.println(classic("stop"));
        try {
            classic(null);
        } catch (NullPointerException e) {
            System.out.println("NPE from classic switch");
        }
        System.out.println(modern(null));
    }
}
```

```text filename:Output
stopping
NPE from classic switch
no command
```

```question
Why is String immutable in Java?

---

(1) The string pool is only safe if pooled strings can't change. (2) Security: class names, file paths and URLs passed to APIs can't be altered after a check. (3) Thread safety for free. (4) The hash code can be cached, which makes strings fast `HashMap` keys.
```

```question
What does intern() do, and should you use it?

---

It returns the canonical pooled copy of the string, adding it to the pool if needed, so equal interned strings are `==`. It can save memory for many duplicate strings, but the pool lookup has a cost — modern G1 also offers `-XX:+UseStringDeduplication`, which deduplicates backing arrays automatically.
```
