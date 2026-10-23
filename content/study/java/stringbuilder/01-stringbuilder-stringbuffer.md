---
id: 1aaad012-6de4-778e-abf3-4e0370daad77
key: topic:java/stringbuilder
subject: java
topic: stringbuilder
title: StringBuilder & StringBuffer
slug: stringbuilder-stringbuffer
order: 1
---

A <em>mutable</em> character buffer. Use `StringBuilder` whenever you build a string piece by piece — especially in loops.

|  | `String` | `StringBuilder` | `StringBuffer` |
| --- | --- | --- | --- |
| Mutable? | No | Yes | Yes |
| Thread-safe? | Yes (immutable) | No | Yes (`synchronized` methods) |
| Speed | Slow for repeated edits | <strong>Fastest</strong> | Slower (locking) |
| Since | 1.0 | 1.5 | 1.0 |
| Use when | Values that don't change | Building strings in one thread (almost always) | Legacy code; shared buffer across threads (rare) |

# Core operations

```java filename:Java
public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder("Java");
        sb.append(' ').append(21).append("!");     // chaining — each call returns this
        System.out.println(sb);
        sb.insert(0, ">> ");
        System.out.println(sb);
        sb.replace(3, 7, "JAVA");
        System.out.println(sb);
        sb.deleteCharAt(sb.length() - 1).delete(0, 3);
        System.out.println(sb);
        sb.setCharAt(0, 'j');
        System.out.println(sb.reverse());
        System.out.println(sb.length() + " " + sb.indexOf("AV") + " " + sb.charAt(0));
        String result = sb.toString();              // freeze into an immutable String
        System.out.println(result);
    }
}
```

```text filename:Output
Java 21!
>> Java 21!
>> JAVA 21!
JAVA 21
12 AVAj
7 3 1
12 AVAj
```

# Capacity

A `StringBuilder` has a <em>capacity</em> (default 16). When full, it grows to roughly `(old * 2) + 2` and copies — amortised O(1) per append. Pre-size with `new StringBuilder(expectedLength)` when you know it.

```java filename:Java
public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        System.out.println(sb.capacity());
        sb.append("12345678901234567");            // 17 chars > 16
        System.out.println(sb.capacity());
        System.out.println(new StringBuilder("abc").capacity());   // 16 + 3
    }
}
```

```text filename:Output
16
34
19
```

# Pitfalls

```java filename:Java
public class Main {
    public static void main(String[] args) {
        StringBuilder a = new StringBuilder("x");
        StringBuilder b = new StringBuilder("x");
        System.out.println(a.equals(b));                          // identity! not overridden
        System.out.println(a.toString().equals(b.toString()));
        System.out.println(a.compareTo(b) == 0);                  // Java 11+: content compare

        StringBuilder c = new StringBuilder('A');                  // char → int capacity 65!
        System.out.println("[" + c + "] " + c.capacity());
    }
}
```

```text filename:Output
false
true
true
[] 65
```

> [!WARNING] Watch out
>
> `StringBuilder` does <strong>not</strong> override `equals`/`hashCode` — compare `toString()` values (or use `compareTo`, Java 11+). And `new StringBuilder('A')` silently calls the `int capacity` constructor.

> [!NOTE] When does + matter?
>
> The compiler already turns `a + b + c` in a <em>single expression</em> into efficient code. The problem is `+=` inside a loop: each iteration creates a new `String`.

```question
Why is StringBuilder faster than String concatenation in a loop?

---

`String` is immutable, so each `s += x` allocates a new string and copies all previous characters: O(n²) total. `StringBuilder` appends into one resizable array: O(n) amortised.
```

```question
StringBuilder vs StringBuffer?

---

Same API. `StringBuffer` methods are `synchronized` (thread-safe, slower); `StringBuilder` is not synchronized and is the default choice. Sharing a builder between threads is a design smell anyway.
```
