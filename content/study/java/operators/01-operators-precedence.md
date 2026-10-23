---
id: 35725320-f6d4-7f34-bce4-22dcdd735d0b
key: topic:java/operators
subject: java
topic: operators
title: Operators & Precedence
slug: operators-precedence
order: 1
---

Java's operators are C-like, with a few Java-specific twists: `>>>`, string `+`, `instanceof`, and strict `boolean` conditions.

| Kind | Operators | Notes |
| --- | --- | --- |
| Arithmetic | `+ - * / %` | Integer `/` truncates toward zero; `%` takes the sign of the dividend |
| Unary | `+ - ++ -- !`, `~` | Prefix `++i` increments then yields; postfix `i++` yields then increments |
| Relational | `== != < <= > >=` | `==` on objects compares references |
| Logical | `&& &#124;&#124; !` | Short-circuit; operands must be `boolean` |
| Bitwise | `& &#124; ^ ~` | On `boolean` operands `&`/`&#124;` evaluate <em>both</em> sides |
| Shift | `<< >> >>>` | `>>` keeps the sign, `>>>` fills with zeros |
| Assignment | `= += -= *= /= %= &= &#124;= ^= <<= >>= >>>=` | Compound forms cast implicitly |
| Ternary | `cond ? a : b` | An expression — yields a value |
| Type | `instanceof` | `obj instanceof String s` binds a variable (Java 16+) |

# Arithmetic details

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(7 / 2 + " " + -7 / 2 + " " + 7 % 3 + " " + -7 % 3);
        System.out.println(Math.floorDiv(-7, 2) + " " + Math.floorMod(-7, 3));
        System.out.println(5.5 % 2);
        int i = 5;
        int a = i++;          // a = 5, then i = 6
        int b = ++i;          // i = 7, then b = 7
        System.out.println(a + " " + b + " " + i);
        String s = "Sum: " + 1 + 2;        // left to right: string concat
        String t = 1 + 2 + " is the sum";  // 3 first, then concat
        System.out.println(s + " | " + t);
    }
}
```

```text filename:Output
3 -3 1 -1
-4 2
1.5
5 7 7
Sum: 12 | 3 is the sum
```

> [!WARNING] Watch out
>
> `i = i++;` leaves `i` unchanged: the old value is saved, `i` is incremented, then the saved old value is assigned back. A classic trick question — never write it.

# Short-circuit evaluation

```java filename:Java
public class Main {
    static boolean check(String label, boolean value) {
        System.out.println("evaluating " + label);
        return value;
    }

    public static void main(String[] args) {
        String s = null;
        if (s != null && s.length() > 3) System.out.println("long");   // safe: right side skipped
        System.out.println(check("A", false) && check("B", true));
        System.out.println(check("C", false) & check("D", true));       // non-short-circuit
    }
}
```

```text filename:Output
evaluating A
false
evaluating C
evaluating D
false
```

# Bitwise &amp; shift operators

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int a = 0b1100, b = 0b1010;
        System.out.println((a & b) + " " + (a | b) + " " + (a ^ b) + " " + ~a);
        System.out.println((1 << 10) + " " + (-16 >> 2) + " " + (-16 >>> 28));
        int n = 12;
        System.out.println("even? " + ((n & 1) == 0));
        System.out.println("power of two? " + (n > 0 && (n & (n - 1)) == 0));
        System.out.println("set bits: " + Integer.bitCount(n));
        int x = 3, y = 9;
        x ^= y; y ^= x; x ^= y;                  // XOR swap
        System.out.println(x + " " + y);
    }
}
```

```text filename:Output
8 14 6 -13
1024 -4 15
even? true
power of two? false
set bits: 2
9 3
```

# Precedence (high → low)

| Level | Operators |
| --- | --- |
| Postfix | `expr++ expr--` |
| Unary | `++expr --expr + - ~ !` and casts |
| Multiplicative | `* / %` |
| Additive | `+ -` |
| Shift | `<< >> >>>` |
| Relational | `< > <= >= instanceof` |
| Equality | `== !=` |
| Bitwise | `&` then `^` then `&#124;` |
| Logical | `&&` then `&#124;&#124;` |
| Ternary | `? :` |
| Assignment | `= += -= …` (right-associative) |

```java filename:Java
public class Main {
    public static void main(String[] args) {
        System.out.println(2 + 3 * 4);
        System.out.println((2 + 3) * 4);
        System.out.println(1 + 2 << 1);           // + binds tighter than <<
        System.out.println(true || false && false);   // && before ||
        int score = 72;
        String grade = score >= 90 ? "A" : score >= 70 ? "B" : "C";
        System.out.println(grade);
    }
}
```

```text filename:Output
14
20
6
true
B
```

> [!NOTE] Tip
>
> When in doubt, add parentheses. Readers shouldn't need the precedence table.

```question
What's the difference between &amp; and &amp;&amp;?

---

`&&` is logical AND with short-circuiting — the right side isn't evaluated if the left is `false`. `&` on booleans evaluates both sides; on integers it is bitwise AND.
```

```question
What is &gt;&gt;&gt;?

---

The unsigned right shift: it shifts in zeros from the left, regardless of sign. `>>` is the arithmetic shift, which copies the sign bit. For negative numbers they differ: `-16 >> 2` is `-4`, `-16 >>> 28` is `15`.
```

```question
What does System.out.println(1 + 2 + "3" + 4 + 5) print?

---

`3345`. Evaluation is left to right: `1 + 2` = `3`, then `3 + "3"` = `"33"`, and from then on every `+` is string concatenation.
```
