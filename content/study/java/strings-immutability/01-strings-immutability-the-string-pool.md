---
id: 68f86f6e-bc39-769f-8b98-a5dc399538af
key: topic:java/strings-immutability
subject: java
topic: strings-immutability
title: Strings, Immutability & the String Pool
slug: strings-immutability-the-string-pool
order: 1
---

`String` is an immutable object, not a primitive. Literals are interned in the <em>string pool</em>, so `==` sometimes “works” — and that is exactly the trap.

> [!INFO]
>
> <strong>String</strong> — a final class holding an immutable sequence of UTF-16 characters (since Java 9 stored compactly as `byte[]` + a coder flag: Latin-1 or UTF-16). Every “modifying” method returns a <em>new</em> `String`.

# Creating strings

| Form | Where it lives | Notes |
| --- | --- | --- |
| `String a = "hi";` | String pool (interned) | Identical literals in the whole JVM share one object |
| `String b = new String("hi");` | A new heap object | Always a distinct object — almost never what you want |
| `"h" + "i"` | Pool | Constant expression — folded to `"hi"` by the compiler |
| `s1 + s2` (non-final variables) | New heap object | Built at runtime (via `StringConcatFactory` since Java 9) |
| `b.intern()` | Pool | Returns the pooled copy (adds it if missing) |

# `==` vs `equals()`

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String a = "java";
        String b = "java";
        String c = new String("java");
        String d = "ja" + "va";          // compile-time constant → pooled
        String part = "ja";
        String e = part + "va";          // runtime concatenation → new object

        System.out.println(a == b);          // same pooled object
        System.out.println(a == c);          // different objects
        System.out.println(a.equals(c));     // same characters
        System.out.println(a == d);
        System.out.println(a == e);
        System.out.println(a == e.intern());
    }
}
```

```text filename:Output
true
false
true
true
false
true
```

> [!WARNING] Watch out
>
> Always compare string <em>contents</em> with `equals()` (or `equalsIgnoreCase()`). `==` compares references and only looks right when both sides happen to be pooled.

> [!TIP] Do
>
> Write `"yes".equals(input)` — the literal on the left can never throw `NullPointerException` when `input` is `null`. Or use `Objects.equals(a, b)`.

# Immutability in action

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String s = "hello";
        s.toUpperCase();                 // result discarded — s is unchanged
        System.out.println(s);
        s = s.toUpperCase();             // rebind the variable to the new object
        System.out.println(s);

        String t = s;
        s = s + "!";                     // creates a new String; t still points at the old one
        System.out.println(t + " " + s);
    }
}
```

```text filename:Output
hello
HELLO
HELLO HELLO!
```

# Why is String immutable?

> [!NOTE] String pool
>
> Sharing one object between many references is only safe if nobody can change it.

> [!NOTE] Security
>
> Class names, file paths, URLs and DB credentials passed as strings can't be altered after validation.

> [!NOTE] Hash caching
>
> `hashCode()` is computed once and cached — perfect for `HashMap` keys.

> [!NOTE] Thread safety
>
> Immutable objects can be shared across threads with no synchronization.

# Concatenation in loops

Each `+=` on a `String` allocates a new object and copies all characters so far — O(n²) for a loop of n appends. Use `StringBuilder` (next topics) or `String.join` / `Collectors.joining`.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        String slow = "";
        for (int i = 0; i < 5; i++) slow += i;      // 5 new String objects

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 5; i++) sb.append(i);   // one growing buffer
        System.out.println(slow + " " + sb);
        System.out.println(String.join("-", "a", "b", "c"));
    }
}
```

```text filename:Output
01234 01234
a-b-c
```

```question
How many objects does new String("abc") create?

---

Up to <strong>two</strong>: the literal `"abc"` is placed in the string pool when the class is loaded (if not already there), and `new` always creates one more `String` object on the heap. If the literal is already pooled, only one new object is created.
```

```question
Where is the string pool located?

---

Since Java 7 it is part of the regular <strong>heap</strong> (it used to be in PermGen), so pooled strings can be garbage-collected when unreferenced.
```

```question
Why is char\[\] preferred over String for passwords?

---

A `String` is immutable and may sit in memory (or the pool) until GC; you cannot wipe it. A `char[]` can be overwritten with zeros right after use, and it doesn't show up by accident in logs via `toString()`.
```
